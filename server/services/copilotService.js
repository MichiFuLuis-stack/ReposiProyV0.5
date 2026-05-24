const fs = require('fs');
const path = require('path');

// Instrucciones del sistema para Gemini
const SYSTEM_INSTRUCTION = `
Eres "Ecosistema Copilot", un asistente virtual con IA experto en ayudar a los usuarios dentro de nuestra suite corporativa.
La suite cuenta con dos herramientas principales:
1. DocPlant: Permite cargar plantillas de Word (.docx) y rellenarlas dinámicamente con contenido en texto o JSON para generar contratos y documentos.
2. FacturAI: Un facturador interactivo directo en pantalla donde el usuario puede rellenar datos de emisor, cliente, y una tabla de productos para descargar facturas formales en tamaño Carta o tickets térmicos POS listos para imprimir en ticketeras de supermercado.

Tus tareas:
- Responder de forma amigable, profesional y concisa en español.
- Guiar a los usuarios en el uso de las herramientas.
- Si el usuario te pide crear una factura (ejemplo: "Crea una factura para Juan Pérez con 3 cables a $2.000"), debes responder de forma amable confirmando la preparación de los datos y, OBLIGATORIAMENTE, estructurar la acción para que el frontend pueda auto-rellenar el formulario.

Formato de respuesta (DEBES responder ÚNICAMENTE con este formato JSON):
{
  "reply": "Mensaje de texto amigable en español explicando lo que hiciste o respondiendo la duda.",
  "action": null o {
    "type": "create_invoice",
    "data": {
      "invoiceNumber": "FAC-XXXXXX" (número aleatorio de 6 dígitos si no se especifica),
      "currency": "CLP" (moneda detectada, CLP o USD),
      "issuer": {
        "name": "Nombre o razón social del emisor si se deduce, o vacío",
        "taxId": "RUT o Tax ID si se deduce, o vacío"
      },
      "client": {
        "name": "Nombre del cliente",
        "taxId": "RUT o Tax ID del cliente si se deduce, o vacío",
        "address": "Dirección si se deduce, o vacío"
      },
      "items": [
        { "description": "Descripción del ítem", "quantity": número, "unitPrice": número, "total": cantidad * unitPrice }
      ],
      "paymentMethod": "Método de pago si se deduce, o vacío"
    }
  }
}
`;

/**
 * Procesa la conversación del Copilot
 * @param {string} message Mensaje del usuario
 * @param {Array} history Historial de la conversación
 * @returns {Promise<Object>} Respuesta estructurada { reply, action }
 */
async function processChat(message, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'tu_api_key_aqui') {
    // Modo simulación heurística local (costo cero y offline por defecto)
    return getHeuristicResponse(message);
  }

  try {
    // Formatear el historial para la API de Gemini
    // Gemini espera una estructura { role: 'user'|'model', parts: [{ text }] }
    const contents = [];
    
    // Añadir historial (últimos 6 mensajes para no sobrecargar contexto)
    const recentHistory = history.slice(-6);
    recentHistory.forEach(msg => {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.sender === 'user' ? msg.text : JSON.stringify({ reply: msg.text }) }]
      });
    });

    // Añadir el mensaje actual del usuario
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en API de Gemini (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const replyText = data.candidates[0].content.parts[0].text;
    
    // Parsear la respuesta JSON de Gemini
    return JSON.parse(replyText);

  } catch (error) {
    console.error('Error llamando a Gemini:', error.message);
    // Fallback silencioso a heurísticas locales ante errores de API (ej: límites de cuota)
    return getHeuristicResponse(message);
  }
}

/**
 * Procesador Heurístico Local por reglas (100% libre de costo y offline)
 */
function getHeuristicResponse(message) {
  const text = message.toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];

  // Estructura de respuesta base
  const response = {
    reply: '',
    action: null
  };

  // Menú de opciones de un clic en frontend
  const menuInfo = "\n\nPuedes probar estos comandos rápidos:\n- **ayuda**: Guía rápida de uso.\n- **factura demo**: Prepara una factura de prueba en el chat.\n- **docplant**: Información sobre DocPlant.\n- **facturai**: Información sobre FacturAI.";

  if (text.includes('hola') || text.includes('saludos') || text.includes('buenos dias') || text.includes('buenas tardes')) {
    response.reply = "¡Hola! Bienvenido al Ecosistema Inteligente. Soy tu asistente virtual Copilot. ¿En qué te puedo ayudar hoy? Puedo explicarte cómo usar las herramientas o ayudarte a preparar facturas y documentos." + menuInfo;
  } 
  
  else if (text.includes('ayuda') || text.includes('como uso') || text.includes('guia')) {
    response.reply = "Aquí tienes una guía rápida del Ecosistema:\n\n" +
                     "1. **DocPlant 🌱**: Ideal para generar contratos, informes o cartas formales. Sube tu plantilla Word (.docx), escribe o pega los datos estructurados en formato de texto o JSON, y haz clic en *Generar*.\n" +
                     "2. **FacturAI 🧾**: Ideal para comercios y servicios. Puedes rellenar los datos de tu empresa emisora y del cliente en el editor de la derecha, agregar los productos en la tabla, y descargar al instante el PDF en tamaño Carta o Ticket POS (térmico para ticketeras).\n\n" +
                     "¿Te gustaría que prepare una factura de prueba para que veas cómo funciona?";
  } 
  
  else if (text.includes('factura demo') || text.includes('factura de prueba') || text.includes('ejemplo de factura')) {
    response.reply = "¡Excelente! He preparado una factura de ejemplo para ti. A continuación aparecerá una tarjeta en el chat. Haz clic en el botón de la tarjeta para cargar todos los datos de ejemplo en FacturAI automáticamente.";
    
    // Crear acción de factura de ejemplo
    response.action = {
      type: 'create_invoice',
      data: {
        invoiceNumber: 'FAC-' + Math.floor(100000 + Math.random() * 900000),
        currency: 'CLP',
        issuer: {
          name: 'Distribuidora Tecnologica S.A.',
          taxId: '76.888.777-K',
          address: 'Av. Providencia 1500, Santiago'
        },
        client: {
          name: 'Comercializadora del Sur Ltda.',
          taxId: '88.333.444-2',
          address: 'Calle O\'Higgins 450, Concepción',
          phone: '+56 41 223 4567',
          email: 'contacto@comercialsur.cl'
        },
        items: [
          { description: 'Notebook Intel i5 16GB RAM', quantity: 1, unitPrice: 650000, total: 650000 },
          { description: 'Mouse Optico Inalambrico', quantity: 3, unitPrice: 15000, total: 45000 },
          { description: 'Monitor LED 24 Pulgadas FHD', quantity: 2, unitPrice: 110000, total: 220000 }
        ],
        paymentMethod: 'Transferencia Bancaria'
      }
    };
  } 
  
  else if (text.includes('docplant') || text.includes('plantilla') || text.includes('contrato')) {
    response.reply = "DocPlant 🌱 te permite automatizar la creación de documentos repetitivos (como contratos de arriendo, cartas de despido, actas, etc.).\n\n" +
                     "Solo subes la plantilla en formato Word con marcadores (como [Nombre], [Fecha]), y agregas los datos reales a la derecha. El sistema reemplazará los marcadores y generará tu Word o PDF en segundos. Ve a **DocPlant** desde la página de inicio para probarlo.";
  } 
  
  else if (text.includes('facturai') || text.includes('facturacion') || text.includes('imprimir') || text.includes('pos') || text.includes('ticket')) {
    response.reply = "FacturAI 🧾 es un editor de facturas directo. Completa los datos en pantalla, agrega tus productos o servicios, y descárgala en formato Carta (A4 formal) o Ticket POS (térmico de 80mm de ancho para ticketeras de supermercado).\n\n" +
                     "El previsualizador de la izquierda te muestra exactamente cómo se verá antes de imprimir. Puedes pulsar *Imprimir* para abrir el diálogo de tu impresora térmica directamente sin descuadres de formato.";
  } 
  
  else if (text.includes('precio') || text.includes('plan') || text.includes('gratis') || text.includes('costo') || text.includes('premium')) {
    response.reply = "El Ecosistema es de uso libre y gratuito por defecto. Cuentas con 5 subidas o generaciones diarias en el plan gratuito. Si requieres subidas ilimitadas y soporte prioritario, puedes revisar nuestro plan Premium en la sección de Precios.";
  } 
  
  else if (text.includes('crea una factura') || text.includes('haz una factura') || text.includes('factura para') || text.includes('generar factura')) {
    // Si intenta crear una factura por lenguaje natural pero no está Gemini configurado,
    // extraemos de forma heurística básica lo que podamos, o le preparamos una estructura limpia.
    // Esto hace que el bot parezca inteligente incluso sin la API key de Gemini.
    response.reply = "He preparado los datos de la factura con los datos que indicaste en el chat. A continuación se mostrará un botón para que cargues estos datos directamente en FacturAI.";
    
    // Analizar si menciona algún nombre de cliente
    let clientName = "Cliente Solicitado";
    const nameMatch = message.match(/(?:para|a)\s+([a-zA-Z\s]{3,20})(?:\s+con|\s+por|\s+de|\s+rut|\.|$)/i);
    if (nameMatch && nameMatch[1]) {
      clientName = nameMatch[1].trim();
    }

    // Analizar cantidades y precios estimados en el mensaje
    const items = [];
    const qtyMatch = message.match(/(\d+)\s+([a-zA-Z\s]{3,15})(?:\s+a\s+|\s+de\s+|\s*\$\s*)(\d+)/i);
    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1], 10);
      const desc = qtyMatch[2].trim();
      const price = parseFloat(qtyMatch[3]);
      items.push({ description: desc, quantity: qty, unitPrice: price, total: qty * price });
    } else {
      items.push({ description: 'Servicios de Consultoria', quantity: 1, unitPrice: 100000, total: 100000 });
    }

    response.action = {
      type: 'create_invoice',
      data: {
        invoiceNumber: 'FAC-' + Math.floor(100000 + Math.random() * 900000),
        currency: 'CLP',
        issuer: {
          name: 'Proveedor de Servicios S.A.',
          taxId: '76.123.456-K',
          address: 'Av. Andres Bello 1234, Providencia, Santiago'
        },
        client: {
          name: clientName,
          taxId: '99.555.666-8',
          address: 'Direccion del Cliente'
        },
        items: items,
        paymentMethod: 'Transferencia Bancaria'
      }
    };
  } 
  
  else {
    response.reply = "Entiendo. Como asistente virtual Copilot, estoy aquí para guiarte en el uso de DocPlant (generador de documentos) y FacturAI (creador de facturas e impresión de tickets térmicos).\n\n" +
                     "Para una experiencia inteligente y personalizada por IA conversacional, puedes configurar tu **GEMINI_API_KEY** gratuita en el archivo `.env`. Mientras tanto, estaré respondiendo en modo local." + menuInfo;
  }

  return response;
}

module.exports = {
  processChat
};
