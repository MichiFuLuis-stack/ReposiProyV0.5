/**
 * DocPlant 🌱 - Modelo de Cliente
 * 
 * Operaciones CRUD para la tabla clients en PostgreSQL.
 */

const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

const Client = {
  /**
   * Crear un nuevo cliente
   */
  async create(data) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const result = await query(`
      INSERT INTO clients (name, email, password_hash, membership)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, membership, daily_uploads_used, last_upload_reset, created_at, updated_at, is_active
    `, [
      data.name.trim(),
      data.email.trim().toLowerCase(),
      passwordHash,
      data.membership || 'free'
    ]);

    return result.rows[0];
  },

  /**
   * Buscar cliente por ID
   */
  async findById(id) {
    const result = await query(`
      SELECT id, name, email, membership, daily_uploads_used,
             last_upload_reset, created_at, updated_at, is_active
      FROM clients WHERE id = $1
    `, [id]);
    return result.rows[0];
  },

  /**
   * Buscar cliente por email (incluye password_hash para autenticación)
   */
  async findByEmail(email) {
    const result = await query(`
      SELECT id, name, email, password_hash, membership,
             daily_uploads_used, last_upload_reset,
             created_at, updated_at, is_active
      FROM clients WHERE email = $1 AND is_active = 1
    `, [email.trim().toLowerCase()]);
    return result.rows[0];
  },

  /**
   * Actualizar membresía del cliente
   */
  async updateMembership(id, membership) {
    const result = await query(`
      UPDATE clients SET membership = $1 WHERE id = $2
    `, [membership, id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Incrementar el contador de subidas diarias
   */
  async updateUploadsCount(id) {
    const client = await Client.findById(id);
    if (!client) return { success: false };

    const lastReset = new Date(client.last_upload_reset);
    const now = new Date();
    const isNewDay = lastReset.toDateString() !== now.toDateString();

    if (isNewDay) {
      await query(`
        UPDATE clients 
        SET daily_uploads_used = 1, 
            last_upload_reset = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
    } else {
      await query(`
        UPDATE clients 
        SET daily_uploads_used = daily_uploads_used + 1
        WHERE id = $1
      `, [id]);
    }

    return { success: true };
  },

  /**
   * Reiniciar contadores de subidas diarias para todos los clientes
   */
  async resetDailyUploads() {
    const result = await query(`
      UPDATE clients 
      SET daily_uploads_used = 0, 
          last_upload_reset = CURRENT_TIMESTAMP
      WHERE daily_uploads_used > 0
    `);
    return { success: true, count: result.rowCount };
  },

  /**
   * Eliminar un cliente (soft delete)
   */
  async delete(id) {
    const result = await query(`
      UPDATE clients SET is_active = 0 WHERE id = $1
    `, [id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Eliminar un cliente permanentemente
   */
  async hardDelete(id) {
    const result = await query(`
      DELETE FROM clients WHERE id = $1
    `, [id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Obtener todos los clientes con paginación
   */
  async getAll(options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (options.membership) {
      whereClause += ` AND membership = $${paramIndex}`;
      params.push(options.membership);
      paramIndex++;
    }

    const countRes = await query(`
      SELECT COUNT(*) as count FROM clients ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const clientsRes = await query(`
      SELECT id, name, email, membership, daily_uploads_used,
             created_at, updated_at, is_active
      FROM clients ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      clients: clientsRes.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Contar total de clientes
   */
  async count(options = {}) {
    let sql = 'SELECT COUNT(*) as count FROM clients';
    const params = [];

    if (options.active !== undefined) {
      sql += ' WHERE is_active = $1';
      params.push(options.active ? 1 : 0);
    }

    const res = await query(sql, params);
    return parseInt(res.rows[0].count, 10);
  },

  /**
   * Buscar clientes
   */
  async search(searchQuery, options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const searchTerm = `%${searchQuery}%`;

    const countRes = await query(`
      SELECT COUNT(*) as count FROM clients
      WHERE (name ILIKE $1 OR email ILIKE $1) AND is_active = 1
    `, [searchTerm]);
    const total = parseInt(countRes.rows[0].count, 10);

    const clientsRes = await query(`
      SELECT id, name, email, membership, daily_uploads_used,
             created_at, updated_at, is_active
      FROM clients
      WHERE (name ILIKE $1 OR email ILIKE $1) AND is_active = 1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [searchTerm, limit, offset]);

    return {
      clients: clientsRes.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Actualizar perfil
   */
  async updateProfile(id, data) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (data.name) {
      updates.push(`name = $${paramIndex}`);
      params.push(data.name.trim());
      paramIndex++;
    }

    if (data.email) {
      updates.push(`email = $${paramIndex}`);
      params.push(data.email.trim().toLowerCase());
      paramIndex++;
    }

    if (updates.length === 0) {
      return { success: false, message: 'No hay datos para actualizar' };
    }

    params.push(id);
    const result = await query(`
      UPDATE clients SET ${updates.join(', ')} WHERE id = $${paramIndex}
    `, params);

    return { success: result.rowCount > 0 };
  },

  /**
   * Cambiar contraseña
   */
  async updatePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    const result = await query(`
      UPDATE clients SET password_hash = $1 WHERE id = $2
    `, [hash, id]);

    return { success: result.rowCount > 0 };
  },

  /**
   * Verificar contraseña
   */
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }
};

module.exports = Client;
