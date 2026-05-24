const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth.middleware');
const { processChat } = require('../services/copilotService');

/**
 * POST /api/copilot/chat
 * Recibe el mensaje actual del usuario y el historial del chat, y devuelve la respuesta de la IA (Gemini o local fallback)
 */
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el mensaje del usuario'
      });
    }

    // Procesar chat con el servicio de IA
    const response = await processChat(message, history || []);

    res.json({
      success: true,
      reply: response.reply,
      action: response.action || null
    });

  } catch (error) {
    console.error('Error en /copilot/chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno en el asistente virtual: ' + error.message
    });
  }
});

module.exports = router;
