/**
 * DocPlant 🌱 - Modelo de Sesiones
 * 
 * Gestión de sesiones tanto autenticadas como anónimas en PostgreSQL.
 */

const { query } = require('../config/database');
const { generateSessionToken, getExpirationDate } = require('../utils/helpers');
const config = require('../config/config');

const Session = {
  /**
   * Crear una nueva sesión
   */
  async create(data) {
    const token = data.session_token || generateSessionToken();
    const expiresAt = data.expires_at || getExpirationDate(config.session.expiryHours);

    const result = await query(`
      INSERT INTO sessions (session_token, client_id, ip_address, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      token,
      data.client_id || null,
      data.ip_address || '0.0.0.0',
      expiresAt
    ]);

    return await Session.findByToken(token);
  },

  /**
   * Buscar sesión por token
   */
  async findByToken(token) {
    const result = await query(`
      SELECT s.*, c.name as client_name, c.email as client_email, c.membership
      FROM sessions s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.session_token = $1 AND s.is_active = 1
        AND s.expires_at > CURRENT_TIMESTAMP
    `, [token]);
    return result.rows[0];
  },

  /**
   * Buscar sesiones activas por cliente
   */
  async findByClientId(clientId) {
    const result = await query(`
      SELECT * FROM sessions 
      WHERE client_id = $1 AND is_active = 1 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `, [clientId]);
    return result.rows;
  },

  /**
   * Incrementar contador de subidas de la sesión
   */
  async updateUploadsCount(token) {
    const result = await query(`
      UPDATE sessions SET uploads_count = uploads_count + 1
      WHERE session_token = $1
    `, [token]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Desactivar una sesión
   */
  async deactivate(token) {
    const result = await query(`
      UPDATE sessions SET is_active = 0 WHERE session_token = $1
    `, [token]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Desactivar todas las sesiones de un cliente
   */
  async deactivateByClient(clientId) {
    const result = await query(`
      UPDATE sessions SET is_active = 0 WHERE client_id = $1
    `, [clientId]);
    return { success: true, count: result.rowCount };
  },

  /**
   * Limpiar sesiones expiradas
   */
  async cleanExpired() {
    const result = await query(`
      UPDATE sessions SET is_active = 0
      WHERE is_active = 1 AND expires_at <= CURRENT_TIMESTAMP
    `);
    return { success: true, count: result.rowCount };
  },

  /**
   * Obtener número de sesiones activas
   */
  async getActiveCount() {
    const result = await query(`
      SELECT COUNT(*) as count FROM sessions 
      WHERE is_active = 1 AND expires_at > CURRENT_TIMESTAMP
    `);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Obtener todas las sesiones activas (admin)
   */
  async getAll(options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const countRes = await query(`
      SELECT COUNT(*) as count FROM sessions WHERE is_active = 1
    `);
    const total = parseInt(countRes.rows[0].count, 10);

    const result = await query(`
      SELECT s.*, c.name as client_name, c.email as client_email
      FROM sessions s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.is_active = 1
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return { sessions: result.rows, total, page, totalPages: Math.ceil(total / limit) };
  }
};

module.exports = Session;
