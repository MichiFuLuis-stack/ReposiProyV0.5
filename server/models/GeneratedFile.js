/**
 * DocPlant 🌱 - Modelo de Archivos Generados
 * 
 * Operaciones para gestionar los documentos generados por el sistema en PostgreSQL.
 */

const { query } = require('../config/database');

const GeneratedFile = {
  /**
   * Registrar un archivo generado
   */
  async create(data) {
    const result = await query(`
      INSERT INTO generated_files (client_id, session_id, template_file_id, content_file_id,
                                    original_name, stored_name, format, file_size, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.client_id || null,
      data.session_id || null,
      data.template_file_id,
      data.content_file_id,
      data.original_name,
      data.stored_name,
      data.format || 'docx',
      data.file_size || 0,
      data.file_path
    ]);

    return result.rows[0];
  },

  /**
   * Buscar archivo generado por ID
   */
  async findById(id) {
    const result = await query(`
      SELECT gf.*, 
             ut.original_name as template_name,
             uc.original_name as content_name
      FROM generated_files gf
      LEFT JOIN uploaded_files ut ON gf.template_file_id = ut.id
      LEFT JOIN uploaded_files uc ON gf.content_file_id = uc.id
      WHERE gf.id = $1 AND gf.is_deleted = 0
    `, [id]);
    return result.rows[0];
  },

  /**
   * Buscar archivos generados por sesión
   */
  async findBySessionId(sessionId) {
    const result = await query(`
      SELECT gf.*, 
             ut.original_name as template_name,
             uc.original_name as content_name
      FROM generated_files gf
      LEFT JOIN uploaded_files ut ON gf.template_file_id = ut.id
      LEFT JOIN uploaded_files uc ON gf.content_file_id = uc.id
      WHERE gf.session_id = $1 AND gf.is_deleted = 0
      ORDER BY gf.generated_at DESC
    `, [sessionId]);
    return result.rows;
  },

  /**
   * Buscar archivos generados por cliente
   */
  async findByClientId(clientId, options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE gf.client_id = $1 AND gf.is_deleted = 0';
    const params = [clientId];
    let paramIndex = 2;

    if (options.format) {
      whereClause += ` AND gf.format = $${paramIndex}`;
      params.push(options.format);
      paramIndex++;
    }

    const countRes = await query(`
      SELECT COUNT(*) as count FROM generated_files gf ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const filesRes = await query(`
      SELECT gf.*, 
             ut.original_name as template_name,
             uc.original_name as content_name
      FROM generated_files gf
      LEFT JOIN uploaded_files ut ON gf.template_file_id = ut.id
      LEFT JOIN uploaded_files uc ON gf.content_file_id = uc.id
      ${whereClause}
      ORDER BY gf.generated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return { files: filesRes.rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Marcar archivo como descargado
   */
  async markDownloaded(id) {
    const result = await query(`
      UPDATE generated_files SET is_downloaded = 1 WHERE id = $1
    `, [id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Marcar archivo como eliminado (soft delete)
   */
  async markDeleted(id) {
    const result = await query(`
      UPDATE generated_files SET is_deleted = 1 WHERE id = $1
    `, [id]);
    return { success: result.rowCount > 0 };
  },

  /**
   * Obtener archivos antiguos para limpieza
   */
  async getOldFiles(hoursOld, anonymousOnly = false) {
    let sql = `
      SELECT * FROM generated_files 
      WHERE is_deleted = 0 
        AND generated_at < CURRENT_TIMESTAMP - interval '${hoursOld} hours'
    `;

    if (anonymousOnly) {
      sql += ' AND client_id IS NULL';
    }

    const result = await query(sql);
    return result.rows;
  },

  /**
   * Eliminar archivos antiguos
   */
  async deleteOld(hoursOld, anonymousOnly = false) {
    let sql = `
      UPDATE generated_files SET is_deleted = 1
      WHERE is_deleted = 0 
        AND generated_at < CURRENT_TIMESTAMP - interval '${hoursOld} hours'
    `;

    if (anonymousOnly) {
      sql += ' AND client_id IS NULL';
    }

    const result = await query(sql);
    return { success: true, count: result.rowCount };
  },

  /**
   * Obtener estadísticas de archivos generados
   */
  async getStats() {
    const totalRes = await query(`
      SELECT COUNT(*) as count FROM generated_files WHERE is_deleted = 0
    `);
    const total = parseInt(totalRes.rows[0].count, 10);

    const totalSizeRes = await query(`
      SELECT COALESCE(SUM(file_size), 0) as total FROM generated_files WHERE is_deleted = 0
    `);
    const totalSize = parseInt(totalSizeRes.rows[0].total, 10);

    const byFormatRes = await query(`
      SELECT format, COUNT(*) as count 
      FROM generated_files WHERE is_deleted = 0
      GROUP BY format
    `);
    const byFormat = byFormatRes.rows;

    const downloadedRes = await query(`
      SELECT COUNT(*) as count FROM generated_files 
      WHERE is_deleted = 0 AND is_downloaded = 1
    `);
    const downloaded = parseInt(downloadedRes.rows[0].count, 10);

    const todayRes = await query(`
      SELECT COUNT(*) as count FROM generated_files 
      WHERE is_deleted = 0 AND DATE(generated_at) = CURRENT_DATE
    `);
    const today = parseInt(todayRes.rows[0].count, 10);

    return { total, totalSize, byFormat, downloaded, today };
  },

  /**
   * Obtener todos los archivos generados (admin)
   */
  async getAll(options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (!options.includeDeleted) {
      whereClause += ' AND gf.is_deleted = 0';
    }

    if (options.format) {
      whereClause += ` AND gf.format = $${paramIndex}`;
      params.push(options.format);
      paramIndex++;
    }

    const countRes = await query(`
      SELECT COUNT(*) as count FROM generated_files gf ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const filesRes = await query(`
      SELECT gf.*, c.name as client_name, c.email as client_email,
             ut.original_name as template_name,
             uc.original_name as content_name
      FROM generated_files gf
      LEFT JOIN clients c ON gf.client_id = c.id
      LEFT JOIN uploaded_files ut ON gf.template_file_id = ut.id
      LEFT JOIN uploaded_files uc ON gf.content_file_id = uc.id
      ${whereClause}
      ORDER BY gf.generated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return { files: filesRes.rows, total, page, totalPages: Math.ceil(total / limit) };
  }
};

module.exports = GeneratedFile;
