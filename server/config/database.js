const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/docplant',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

// Initialization function
async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove comments and split by semicolon (naive approach, but better to execute as one block)
    await query(schema);
    console.log('✅ Esquema de PostgreSQL inicializado');

    // Create default admin user
    await createDefaultAdmin();

    console.log('✅ Base de datos lista (PostgreSQL)');
  } catch (err) {
    console.error('❌ Error inicializando la base de datos:', err);
  }
}

async function createDefaultAdmin() {
  try {
    const { rows } = await query('SELECT id FROM clients WHERE email = $1', [config.admin.email]);
    if (rows.length === 0) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(config.admin.password, salt);
      
      await query(`
        INSERT INTO clients (name, email, password_hash, membership, is_active)
        VALUES ($1, $2, $3, 'admin', 1)
      `, [config.admin.name, config.admin.email, passwordHash]);
      
      console.log(`✅ Usuario administrador creado: ${config.admin.email}`);
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
