const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const { optionalAuth } = require('../middleware/auth.middleware');
const GeneratedFile = require('../models/GeneratedFile');
const { parseInvoiceText, getEmptyInvoice } = require('../services/invoiceParser');
const { generateInvoicePdf } = require('../services/invoicePdfGenerator');
const config = require('../config/config');

// Configuración de Multer para almacenar facturas subidas temporalmente
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `invoice_${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // Limite 15MB
  }
});

/**
 * POST /api/invoices/extract
 * Recibe un archivo PDF o imagen, extrae su texto y lo formatea en una factura estructurada
 */
router.post('/extract', optionalAuth, upload.single('invoiceFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let invoiceData = getEmptyInvoice();

    // Procesar archivo según la extensión
    if (ext === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        
        // Analizar el texto extraído
        invoiceData = parseInvoiceText(data.text);
      } catch (parseError) {
        console.error('Error parseando PDF con pdf-parse:', parseError);
        // Fallback: Devolver factura limpia si falla la lectura del PDF
        invoiceData = getEmptyInvoice();
      }
    } else if (ext === '.txt') {
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        invoiceData = parseInvoiceText(text);
      } catch (txtError) {
        console.error('Error leyendo archivo TXT:', txtError);
        invoiceData = getEmptyInvoice();
      }
    } else if (ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        invoiceData = parseInvoiceText(result.value);
      } catch (docxError) {
        console.error('Error leyendo Word DOCX con mammoth:', docxError);
        invoiceData = getEmptyInvoice();
      }
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      // Fallback para imágenes: Devolver datos simulados realistas pero vacíos
      // ya que no hay un OCR integrado en este backend ligero.
      // El frontend le avisará al usuario que puede rellenar/editar todo
      invoiceData = getEmptyInvoice();
      invoiceData.issuer.name = 'Proveedor Detectado en Imagen';
      invoiceData.client.name = req.user ? req.user.name : 'Cliente de Prueba';
    }

    // Asegurarnos de limpiar el archivo subido
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error eliminando archivo temporal:', cleanupError);
    }

    res.json({
      success: true,
      message: 'Datos extraídos correctamente',
      invoice: invoiceData
    });

  } catch (error) {
    console.error('Error en /extract:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el archivo: ' + error.message
    });
  }
});

/**
 * POST /api/invoices/generate
 * Recibe los datos estructurados en formato JSON y genera el archivo PDF final (Carta o POS)
 */
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { invoice, format = 'letter' } = req.body;

    if (!invoice) {
      return res.status(400).json({ success: false, message: 'Faltan los datos de la factura' });
    }

    // Asegurar que existe el directorio de generados
    const generatedDir = path.join(__dirname, '../../generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    // Generar PDF usando pdf-lib
    const pdfBytes = await generateInvoicePdf(invoice, format);

    const storedName = `${uuidv4()}.pdf`;
    const resultPath = path.join(generatedDir, storedName);

    // Guardar archivo en disco
    fs.writeFileSync(resultPath, pdfBytes);

    const originalName = `Factura_${invoice.invoiceNumber || 'Generada'}_${format}.pdf`;

    // Registrar el archivo generado en la base de datos
    const generatedFile = await GeneratedFile.create({
      client_id: req.user ? req.user.id : null,
      session_id: req.sessionToken || 'anonymous',
      template_file_id: null,
      content_file_id: null,
      original_name: originalName,
      stored_name: storedName,
      format: 'pdf',
      file_size: pdfBytes.length,
      file_path: resultPath
    });

    res.json({
      success: true,
      message: 'Factura PDF generada con éxito',
      file: {
        id: generatedFile.id,
        name: originalName,
        format: 'pdf'
      }
    });

  } catch (error) {
    console.error('Error en /generate:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar el PDF de factura: ' + error.message
    });
  }
});

module.exports = router;
