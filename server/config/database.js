const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

let pool = null;
let useMock = false;

// Base de datos en memoria para modo simulación (fallback local)
const mockDb = {
  clients: [],
  sessions: [],
  uploaded_files: [],
  generated_files: [],
  invoices: []
};

// Intentar inicializar el pool de PostgreSQL
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/docplant',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 3000 // Timeout rápido para no bloquear
  });
} catch (e) {
  console.warn('⚠️ No se pudo conectar a PostgreSQL. Activando modo simulación en memoria.');
  useMock = true;
}

// Ejecutor de consultas con fallback a simulación en memoria
const query = async (text, params) => {
  if (useMock) {
    return runMockQuery(text, params);
  }

  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    // Si es un error de autenticación o conexión, cambiar a simulación
    if (error.code === '28P01' || error.message.includes('auth') || error.message.includes('connect')) {
      if (!useMock) {
        console.warn('⚠️ Error de credenciales o conexión en PostgreSQL. Cambiando a simulación en memoria.');
        useMock = true;
      }
      return runMockQuery(text, params);
    }
    throw error;
  }
};

// Motor básico de consultas en memoria para evitar errores de ejecución local
function runMockQuery(text, params) {
  const q = text.trim().replace(/\s+/g, ' ').toUpperCase();
  
  // 1. SELECT CLIENTS
  if (q.includes('SELECT ID FROM CLIENTS WHERE EMAIL = $1')) {
    const email = params[0];
    const client = mockDb.clients.find(c => c.email === email);
    return { rows: client ? [client] : [], rowCount: client ? 1 : 0 };
  }

  if (q.includes('FROM GENERATED_FILES') && (q.includes('GF.ID = $1') || q.includes('ID = $1'))) {
    const id = params[0];
    const file = mockDb.generated_files.find(f => f.id === parseInt(id) || f.id === id);
    return { rows: file ? [file] : [], rowCount: file ? 1 : 0 };
  }

  if (q.includes('INSERT INTO CLIENTS')) {
    const newItem = {
      id: mockDb.clients.length + 1,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      membership: params[3] || 'free',
      is_active: 1
    };
    mockDb.clients.push(newItem);
    return { rows: [newItem], rowCount: 1 };
  }

  // 2. INSERT GENERATED_FILES
  if (q.includes('INSERT INTO GENERATED_FILES')) {
    const newItem = {
      id: mockDb.generated_files.length + 1,
      client_id: params[0],
      session_id: params[1],
      template_file_id: params[2],
      content_file_id: params[3],
      original_name: params[4],
      stored_name: params[5],
      format: params[6],
      file_size: params[7],
      file_path: params[8],
      generated_at: new Date().toISOString(),
      is_downloaded: 0,
      is_deleted: 0
    };
    mockDb.generated_files.push(newItem);
    return { rows: [newItem], rowCount: 1 };
  }

  // 3. SELECT GENERATED_FILES
  if (q.includes('WHERE GF.SESSION_ID = $1')) {
    const sessionId = params[0];
    const list = mockDb.generated_files.filter(f => f.session_id === sessionId && f.is_deleted === 0);
    return { rows: list, rowCount: list.length };
  }

  if (q.includes('WHERE GF.CLIENT_ID = $1')) {
    const clientId = params[0];
    const list = mockDb.generated_files.filter(f => f.client_id === clientId && f.is_deleted === 0);
    return { rows: list, rowCount: list.length };
  }

  if (q.includes('UPDATE GENERATED_FILES SET IS_DOWNLOADED = 1')) {
    const id = params[0];
    const file = mockDb.generated_files.find(f => f.id === parseInt(id) || f.id === id);
    if (file) file.is_downloaded = 1;
    return { rowCount: file ? 1 : 0 };
  }

  return { rows: [], rowCount: 0 };
}

// Inicialización de la base de datos
async function initDatabase() {
  if (useMock) {
    console.log('💡 Base de datos iniciada en Modo Simulación Temporal (Memoria)');
    return;
  }

  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await query(schema);
    console.log('✅ Esquema de PostgreSQL inicializado correctamente');

    await createDefaultAdmin();
    console.log('✅ Base de datos lista (PostgreSQL)');
  } catch (err) {
    console.warn('❌ Error inicializando base de datos PostgreSQL. Activando fallback en memoria:', err.message);
    useMock = true;
  }
}

async function createDefaultAdmin() {
  try {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(config.admin.password, salt);

    const { rows } = await query('SELECT id FROM clients WHERE email = $1', [config.admin.email]);
    if (rows.length === 0) {
      await query(`
        INSERT INTO clients (name, email, password_hash, membership, is_active)
        VALUES ($1, $2, $3, 'admin', 1)
      `, [config.admin.name, config.admin.email, passwordHash]);
      console.log(`✅ Usuario administrador creado: ${config.admin.email}`);
    } else {
      await query(`
        UPDATE clients SET password_hash = $1, membership = 'admin' WHERE email = $2
      `, [passwordHash, config.admin.email]);
      console.log(`✅ Contraseña del administrador sincronizada: ${config.admin.email}`);
    }
  } catch (err) {
    console.error('Error creando administrador por defecto:', err);
  }
}

module.exports = {
  pool,
  query,
  initDatabase
};
