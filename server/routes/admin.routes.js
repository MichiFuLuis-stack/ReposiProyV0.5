const express = require('express');
const router = express.Router();
const os = require('os');
const { query } = require('../config/database');
const { adminOnly } = require('../middleware/auth.middleware');
const Client = require('../models/Client');
const UploadedFile = require('../models/UploadedFile');
const GeneratedFile = require('../models/GeneratedFile');

// Apply admin protection to all routes
router.use(adminOnly);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalClients = await Client.count();
    const storageStats = await UploadedFile.getStats();
    
    res.json({
      success: true,
      stats: {
        totalClients,
        totalFilesProcessed: storageStats.total || 0,
        storageUsed: storageStats.totalSize || 0,
        activeSessions: 5 // Mock for now
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/server
router.get('/server', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  res.json({
    success: true,
    stats: {
      cpu: os.cpus()[0].model,
      cpuUsage: Math.round(process.cpuUsage().user / 1000000), // very rough estimate
      memoryTotal: totalMem,
      memoryUsed: totalMem - freeMem,
      memoryFree: freeMem,
      uptime: os.uptime(),
      platform: os.platform(),
      nodeVersion: process.version
    }
  });
});

// GET /api/admin/database/:table
router.get('/database/:table', async (req, res) => {
  try {
    const table = req.params.table;
    const allowedTables = ['clients', 'uploaded_files', 'generated_files', 'invoices', 'sessions'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ success: false, message: 'Tabla no permitida' });
    }

    const result = await query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 50`);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/database/:table/:id
router.delete('/database/:table/:id', async (req, res) => {
  try {
    const table = req.params.table;
    const id = req.params.id;
    const allowedTables = ['clients', 'uploaded_files', 'generated_files', 'invoices', 'sessions'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ success: false, message: 'Tabla no permitida' });
    }

    const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    res.json({ success: true, message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
