/**
 * DocPlant 🌱 - Modelo de Archivos Subidos
 * 
 * Operaciones para gestionar archivos subidos por usuarios en PostgreSQL.
 */

const { query } = require('../config/database');

const UploadedFile = {
  /**
   * Registrar un archivo subido
   */
  async create(data) {
    const result = await query(`
      INSERT INTO uploaded_files (client_id, session_id, original_name, stored_name, 
                                   file_type, mime_type, file_size, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.client_id || null,
      data.session_id || null,
      data.original_name,
      data.stored_name,
      data.file_type,
      data.mime_type,
      data.file_size,
      data.file_path
    ]);

    return result.rows[0];
  },

  /**
   * Buscar archivo por ID
   */
  async findById(id) {
    const result = await query(`
      SELECT * FROM uploaded_files WHERE id = $1 AND is_deleted = 0
    `, [id]);
    return result.rows[0];
  },

  /**
   * Buscar archivos por sesión
   */
  async findBySessionId(sessionId) {
    const result = await query(`
      SELECT * FROM uploaded_files 
      WHERE session_id = $1 AND is_deleted = 0
      ORDER BY uploaded_at DESC
    `, [sessionId]);
    return result.rows;
  },

  /**
   * Buscar archivos por cliente
   */
  async findByClientId(clientId, options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE client_id = $1 AND is_deleted = 0';
    const params = [clientId];
    let paramIndex = 2;

    if (options.file_type) {
      whereClause += ` AND file_type = $${paramIndex}`;
      params.push(options.file_type);
      paramIndex++;
    }

    const countRes = await query(`
      SELECT COUNT(*) as count FROM uploaded_files ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const filesRes = await query(`
      SELECT * FROM uploaded_files ${whereClause}
      ORDER BY uploaded_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return { files: filesRes.rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Marcar archivo como procesado
   */
  async markProcessed(id) {
    const result = await query(`
      UPDATE uploaded_files SET is_processed = 1 WHERE id = $1
    `, [id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Marcar archivo como eliminado (soft delete)
   */
  async markDeleted(id) {
    const result = await query(`
      UPDATE uploaded_files SET is_deleted = 1 WHERE id = $1
    `, [id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Obtener archivos antiguos para limpieza
   */
  async getOldFiles(hoursOld, anonymousOnly = false) {
    let sql = `
      SELECT * FROM uploaded_files 
      WHERE is_deleted = 0 
        AND uploaded_at < CURRENT_TIMESTAMP - interval '${hoursOld} hours'
    `;

    if (anonymousOnly) {
      sql += ' AND client_id IS NULL';
    }

    const result = await query(sql);
    return result.rows;
  },

  /**
   * Eliminar archivos antiguos de la BD
   */
  async deleteOld(hoursOld, anonymousOnly = false) {
    let sql = `
      UPDATE uploaded_files SET is_deleted = 1
      WHERE is_deleted = 0 
        AND uploaded_at < CURRENT_TIMESTAMP - interval '${hoursOld} hours'
    `;

    if (anonymousOnly) {
      sql += ' AND client_id IS NULL';
    }

    const result = await query(sql);
    return { success: true, count: result.rowCount };
  },

  /**
   * Obtener estadísticas de archivos subidos
   */
  async getStats() {
    const totalRes = await query(`
      SELECT COUNT(*) as count FROM uploaded_files WHERE is_deleted = 0
    `);
    const total = parseInt(totalRes.rows[0].count, 10);

    const totalSizeRes = await query(`
      SELECT COALESCE(SUM(file_size), 0) as total FROM uploaded_files WHERE is_deleted = 0
    `);
    const totalSize = parseInt(totalSizeRes.rows[0].total, 10);

    const byTypeRes = await query(`
      SELECT file_type, COUNT(*) as count 
      FROM uploaded_files WHERE is_deleted = 0
      GROUP BY file_type
    `);
    const byType = byTypeRes.rows;

    const todayRes = await query(`
      SELECT COUNT(*) as count FROM uploaded_files 
      WHERE is_deleted = 0 AND DATE(uploaded_at) = CURRENT_DATE
    `);
    const today = parseInt(todayRes.rows[0].count, 10);

    return { total, totalSize, byType, today };
  },

  /**
   * Obtener todos los archivos con filtros (para admin)
   */
  async getAll(options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (!options.includeDeleted) {
      whereClause += ' AND uf.is_deleted = 0';
    }

    if (options.file_type) {
      whereClause += ` AND uf.file_type = $${paramIndex}`;
      params.push(options.file_type);
      paramIndex++;
    }

    const countRes = await query(`
      SELECT COUNT(*) as count FROM uploaded_files uf ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const filesRes = await query(`
      SELECT uf.*, c.name as client_name, c.email as client_email
      FROM uploaded_files uf
      LEFT JOIN clients c ON uf.client_id = c.id
      ${whereClause}
      ORDER BY uf.uploaded_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return { files: filesRes.rows, total, page, totalPages: Math.ceil(total / limit) };
  }
};

module.exports = UploadedFile;
