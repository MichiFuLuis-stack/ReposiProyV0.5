const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Normaliza y elimina acentos y caracteres especiales para evitar errores de codificación en fuentes estándar de pdf-lib.
 * @param {string} text Texto a normalizar
 * @returns {string} Texto limpio
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[áäâà]/g, 'a')
    .replace(/[éëêè]/g, 'e')
    .replace(/[íïîì]/g, 'i')
    .replace(/[óöôò]/g, 'o')
    .replace(/[úüûù]/g, 'u')
    .replace(/[ÁÄÂÀ]/g, 'A')
    .replace(/[ÉËÊÈ]/g, 'E')
    .replace(/[ÍÏÎÌ]/g, 'I')
    .replace(/[ÓÖÔÒ]/g, 'O')
    .replace(/[ÚÜÛÙ]/g, 'U')
    .replace(/[ñ]/g, 'n')
    .replace(/[Ñ]/g, 'N')
    .replace(/[º°]/g, 'o.')
    .replace(/[^a-zA-Z0-9\s.,;:#$%&'()*+\-/=_@]/g, ''); // Remover otros caracteres incompatibles
}

/**
 * Formatea un número como moneda
 */
function formatCurrency(value, currency = 'CLP') {
  if (currency === 'CLP') {
    return '$' + Math.round(value).toLocaleString('es-CL');
  }
  return '$' + parseFloat(value).toFixed(2).toLocaleString('en-US');
}

/**
 * Genera el PDF de la factura
 * @param {object} invoice Datos de la factura
 * @param {string} format Formato de salida ('letter' o 'pos')
 * @returns {Promise<Buffer>} Buffer del archivo PDF generado
 */
async function generateInvoicePdf(invoice, format = 'letter') {
  const pdfDoc = await PDFDocument.create();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (format === 'pos') {
    await renderPosTicket(pdfDoc, invoice, font, fontBold);
  } else {
    await renderLetterInvoice(pdfDoc, invoice, font, fontBold);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Renderiza el formato Ticket Térmico de 80mm
 */
async function renderPosTicket(pdfDoc, invoice, font, fontBold) {
  // Ancho estándar de ticket térmico 80mm en puntos PDF (1 mm = 2.83465 puntos)
  const pageWidth = 226.77; // 80mm
  
  // Calcular altura de página dinámica basada en la cantidad de ítems para un rollo continuo
  const headerHeight = 160;
  const itemsHeight = invoice.items.length * 24;
  const footerHeight = 140;
  const pageHeight = headerHeight + itemsHeight + footerHeight;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);
  let y = pageHeight - 15;

  // Emisor
  page.drawText(cleanText(invoice.issuer.name).toUpperCase(), {
    x: pageWidth / 2,
    y: y,
    size: 9,
    font: fontBold,
    color: rgb(0.06, 0.1, 0.08), // Color muy oscuro a juego
    alignment: 'center'
  });
  y -= 12;

  page.drawText(cleanText(`RUT: ${invoice.issuer.taxId}`), {
    x: pageWidth / 2,
    y: y,
    size: 7.5,
    font: font,
    alignment: 'center'
  });
  y -= 10;

  page.drawText(cleanText(invoice.issuer.address), {
    x: pageWidth / 2,
    y: y,
    size: 6.5,
    font: font,
    alignment: 'center'
  });
  y -= 10;

  if (invoice.issuer.phone) {
    page.drawText(cleanText(`Tel: ${invoice.issuer.phone}`), {
      x: pageWidth / 2,
      y: y,
      size: 6.5,
      font: font,
      alignment: 'center'
    });
    y -= 12;
  }

  // Divisor
  page.drawText('------------------------------------------', { x: margin, y: y, size: 8, font: font });
  y -= 10;

  // Título e info Factura
  page.drawText(cleanText(`FACTURA ELECTRONICA`), { x: margin, y: y, size: 8.5, font: fontBold });
  page.drawText(cleanText(`N: ${invoice.invoiceNumber}`), { x: pageWidth - margin - 60, y: y, size: 8.5, font: fontBold });
  y -= 12;

  page.drawText(cleanText(`Fecha: ${invoice.date}`), { x: margin, y: y, size: 7, font: font });
  y -= 12;

  // Cliente
  page.drawText(cleanText(`CLIENTE: ${invoice.client.name}`), { x: margin, y: y, size: 7.5, font: fontBold });
  y -= 10;
  page.drawText(cleanText(`RUT: ${invoice.client.taxId}`), { x: margin, y: y, size: 7, font: font });
  y -= 10;
  page.drawText(cleanText(`Direccion: ${invoice.client.address}`), { x: margin, y: y, size: 6.5, font: font });
  y -= 12;

  // Divisor
  page.drawText('------------------------------------------', { x: margin, y: y, size: 8, font: font });
  y -= 10;

  // Encabezado Tabla
  page.drawText('CANT/DESCRIPCION', { x: margin, y: y, size: 7, font: fontBold });
  page.drawText('TOTAL', { x: pageWidth - margin - 30, y: y, size: 7, font: fontBold });
  y -= 10;

  page.drawText('------------------------------------------', { x: margin, y: y, size: 8, font: font });
  y -= 10;

  // Ítems
  for (const item of invoice.items) {
    const itemTotalStr = formatCurrency(item.total, invoice.currency);
    const unitPriceStr = formatCurrency(item.unitPrice, invoice.currency);
    const qtyStr = `${item.quantity} x ${unitPriceStr}`;

    // Dibujar descripción
    page.drawText(cleanText(item.description).substring(0, 26), {
      x: margin,
      y: y,
      size: 7,
      font: font
    });
    
    // Dibujar total
    page.drawText(itemTotalStr, {
      x: pageWidth - margin - font.widthOfTextAtSize(itemTotalStr, 7),
      y: y,
      size: 7,
      font: font
    });
    y -= 10;

    // Dibujar cantidad x precio unitario debajo
    page.drawText(qtyStr, {
      x: margin + 10,
      y: y,
      size: 6,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    });
    y -= 12;
  }

  // Divisor
  page.drawText('------------------------------------------', { x: margin, y: y, size: 8, font: font });
  y -= 10;

  // Totales
  const subtotalStr = formatCurrency(invoice.subtotal, invoice.currency);
  const taxStr = formatCurrency(invoice.taxAmount, invoice.currency);
  const totalStr = formatCurrency(invoice.total, invoice.currency);

  page.drawText('SUBTOTAL:', { x: margin + 30, y: y, size: 7.5, font: font });
  page.drawText(subtotalStr, { x: pageWidth - margin - font.widthOfTextAtSize(subtotalStr, 7.5), y: y, size: 7.5, font: font });
  y -= 10;

  page.drawText(`IVA (${Math.round(invoice.taxRate * 100)}%):`, { x: margin + 30, y: y, size: 7.5, font: font });
  page.drawText(taxStr, { x: pageWidth - margin - font.widthOfTextAtSize(taxStr, 7.5), y: y, size: 7.5, font: font });
  y -= 12;

  page.drawText('TOTAL A PAGAR:', { x: margin + 20, y: y, size: 8.5, font: fontBold });
  page.drawText(totalStr, { x: pageWidth - margin - fontBold.widthOfTextAtSize(totalStr, 8.5), y: y, size: 8.5, font: fontBold });
  y -= 15;

  page.drawText('------------------------------------------', { x: margin, y: y, size: 8, font: font });
  y -= 12;

  // Info Pago y Agradecimiento
  page.drawText(cleanText(`Metodo de Pago: ${invoice.paymentMethod}`), { x: margin, y: y, size: 7, font: font });
  y -= 12;

  page.drawText('Gracias por su preferencia!', {
    x: pageWidth / 2,
    y: y,
    size: 8,
    font: fontBold,
    alignment: 'center'
  });
  y -= 10;

  page.drawText('Documento Tributario Electronico', {
    x: pageWidth / 2,
    y: y,
    size: 6,
    font: font,
    alignment: 'center',
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 10;

  // Código de barras simulado (líneas verticales de diferente grosor)
  const barcodeX = pageWidth / 2 - 40;
  const barcodeY = y - 15;
  page.drawRectangle({
    x: barcodeX,
    y: barcodeY,
    width: 80,
    height: 12,
    color: rgb(0.9, 0.9, 0.9)
  });

  // Dibujar barritas
  let barX = barcodeX + 4;
  while (barX < barcodeX + 76) {
    const width = Math.random() > 0.4 ? 1.5 : 0.5;
    page.drawRectangle({
      x: barX,
      y: barcodeY + 1,
      width: width,
      height: 10,
      color: rgb(0.1, 0.1, 0.1)
    });
    barX += width + (Math.random() > 0.5 ? 1 : 2);
  }
}

/**
 * Renderiza el formato Carta (Letter/A4) elegante
 */
async function renderLetterInvoice(pdfDoc, invoice, font, fontBold) {
  // Dimensiones estándar Carta: 612 x 792 puntos
  const pageWidth = 612;
  const pageHeight = 792;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 40;
  let y = pageHeight - margin;

  // Colores corporativos (Verde esmeralda y cian a juego con DocPlant)
  const colorPrimary = rgb(0.06, 0.45, 0.32); // #10b981 oscuro
  const colorSecondary = rgb(0.02, 0.42, 0.49); // #06b6d4 oscuro
  const colorDark = rgb(0.07, 0.1, 0.09);
  const colorLight = rgb(0.95, 0.97, 0.96);
  const colorGray = rgb(0.5, 0.5, 0.5);

  // --- CABECERA ---
  // Rectángulo decorativo superior
  page.drawRectangle({
    x: 0,
    y: pageHeight - 12,
    width: pageWidth,
    height: 12,
    color: colorPrimary
  });
  y -= 25;

  // Nombre Emisor
  page.drawText(cleanText(invoice.issuer.name).toUpperCase(), {
    x: margin,
    y: y,
    size: 18,
    font: fontBold,
    color: colorPrimary
  });

  // Recuadro Factura (Lado Derecho)
  const rWidth = 180;
  const rHeight = 85;
  const rX = pageWidth - margin - rWidth;
  const rY = y - 55;

  page.drawRectangle({
    x: rX,
    y: rY,
    width: rWidth,
    height: rHeight,
    borderColor: colorPrimary,
    borderWidth: 1.5,
    color: colorLight
  });

  page.drawText('R.U.T.: ' + cleanText(invoice.issuer.taxId), {
    x: rX + 15,
    y: rY + 65,
    size: 10,
    font: fontBold,
    color: colorDark
  });
  page.drawText('FACTURA ELECTRONICA', {
    x: rX + 15,
    y: rY + 45,
    size: 9,
    font: fontBold,
    color: colorPrimary
  });
  page.drawText('N° ' + cleanText(invoice.invoiceNumber), {
    x: rX + 15,
    y: rY + 20,
    size: 12,
    font: fontBold,
    color: rgb(0.93, 0.27, 0.27) // Rojo suave
  });

  // Datos Emisor (Abajo del Nombre Emisor)
  y -= 18;
  page.drawText(cleanText(invoice.issuer.address), { x: margin, y: y, size: 8.5, font: font, color: colorDark });
  y -= 12;
  page.drawText(cleanText(`Teléfono: ${invoice.issuer.phone || 'No disponible'}`), { x: margin, y: y, size: 8.5, font: font, color: colorDark });
  y -= 12;
  page.drawText(cleanText(`Email: ${invoice.issuer.email || 'contacto@empresa.com'}`), { x: margin, y: y, size: 8.5, font: font, color: colorDark });
  
  y = rY - 25;

  // --- DATOS DEL RECEPTOR (CLIENTE) ---
  page.drawRectangle({
    x: margin,
    y: y - 75,
    width: pageWidth - (margin * 2),
    height: 75,
    color: colorLight,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1
  });

  let cy = y - 15;
  page.drawText('SEÑOR(ES):', { x: margin + 12, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.client.name).toUpperCase(), { x: margin + 80, y: cy, size: 8.5, font: fontBold, color: colorDark });
  
  page.drawText('R.U.T.:', { x: pageWidth - margin - 150, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.client.taxId), { x: pageWidth - margin - 100, y: cy, size: 8.5, font: fontBold, color: colorDark });

  cy -= 15;
  page.drawText('DIRECCION:', { x: margin + 12, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.client.address), { x: margin + 80, y: cy, size: 8.5, font: font, color: colorDark });

  cy -= 15;
  page.drawText('TELEFONO:', { x: margin + 12, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.client.phone || 'No registrado'), { x: margin + 80, y: cy, size: 8.5, font: font, color: colorDark });

  page.drawText('EMAIL:', { x: pageWidth - margin - 150, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.client.email || 'No registrado'), { x: pageWidth - margin - 100, y: cy, size: 8.5, font: font, color: colorDark });

  cy -= 15;
  page.drawText('FECHA EMIS.:', { x: margin + 12, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.date), { x: margin + 80, y: cy, size: 8.5, font: font, color: colorDark });

  page.drawText('FECHA VENC.:', { x: pageWidth - margin - 150, y: cy, size: 8, font: fontBold, color: colorGray });
  page.drawText(cleanText(invoice.dueDate), { x: pageWidth - margin - 100, y: cy, size: 8.5, font: font, color: colorDark });

  y -= 105;

  // --- TABLA DE ITEMS ---
  // Cabecera Tabla
  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: pageWidth - (margin * 2),
    height: 20,
    color: colorPrimary
  });

  page.drawText('CANT.', { x: margin + 10, y: y - 13, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('DESCRIPCION DE PRODUCTO / SERVICIO', { x: margin + 60, y: y - 13, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('P. UNITARIO', { x: pageWidth - margin - 140, y: y - 13, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('TOTAL', { x: pageWidth - margin - 60, y: y - 13, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });

  y -= 20;

  // Cuerpo Tabla
  let tableIndex = 0;
  for (const item of invoice.items) {
    const itemHeight = 22;
    const rowColor = tableIndex % 2 === 0 ? rgb(1, 1, 1) : colorLight;

    page.drawRectangle({
      x: margin,
      y: y - itemHeight,
      width: pageWidth - (margin * 2),
      height: itemHeight,
      color: rowColor,
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5
    });

    const qtyStr = item.quantity.toString();
    const priceStr = formatCurrency(item.unitPrice, invoice.currency);
    const totalStr = formatCurrency(item.total, invoice.currency);

    page.drawText(qtyStr, { x: margin + 10, y: y - 15, size: 8, font: font, color: colorDark });
    page.drawText(cleanText(item.description).substring(0, 70), { x: margin + 60, y: y - 15, size: 8, font: font, color: colorDark });
    
    // Alineación derecha para números
    const priceWidth = font.widthOfTextAtSize(priceStr, 8);
    page.drawText(priceStr, { x: pageWidth - margin - 85 - priceWidth, y: y - 15, size: 8, font: font, color: colorDark });

    const totalWidth = font.widthOfTextAtSize(totalStr, 8);
    page.drawText(totalStr, { x: pageWidth - margin - 10 - totalWidth, y: y - 15, size: 8, font: font, color: colorDark });

    y -= itemHeight;
    tableIndex++;
  }

  y -= 15;

  // --- TOTALES Y DETALLES PAGO ---
  // Forma de Pago (Lado Izquierdo)
  const payBoxWidth = 220;
  page.drawRectangle({
    x: margin,
    y: y - 45,
    width: payBoxWidth,
    height: 45,
    color: colorLight,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 0.5
  });

  page.drawText('INFORMACION DE PAGO', { x: margin + 10, y: y - 12, size: 7.5, font: fontBold, color: colorSecondary });
  page.drawText(`Metodo: ${cleanText(invoice.paymentMethod)}`, { x: margin + 10, y: y - 25, size: 7.5, font: font });
  page.drawText(`Moneda: ${invoice.currency}`, { x: margin + 10, y: y - 37, size: 7.5, font: font });

  // Cuadro Totales (Lado Derecho)
  const totalsY = y;
  const subtotalStr = formatCurrency(invoice.subtotal, invoice.currency);
  const taxStr = formatCurrency(invoice.taxAmount, invoice.currency);
  const totalStr = formatCurrency(invoice.total, invoice.currency);

  const tLabelX = pageWidth - margin - 180;
  const tValX = pageWidth - margin - 10;

  y -= 12;
  page.drawText('MONTO NETO:', { x: tLabelX, y: y, size: 8.5, font: font, color: colorDark });
  page.drawText(subtotalStr, { x: tValX - font.widthOfTextAtSize(subtotalStr, 8.5), y: y, size: 8.5, font: font });

  y -= 14;
  page.drawText(`I.V.A. (${Math.round(invoice.taxRate * 100)}%):`, { x: tLabelX, y: y, size: 8.5, font: font, color: colorDark });
  page.drawText(taxStr, { x: tValX - font.widthOfTextAtSize(taxStr, 8.5), y: y, size: 8.5, font: font });

  y -= 18;
  page.drawRectangle({
    x: tLabelX - 10,
    y: y - 4,
    width: 200,
    height: 20,
    color: colorLight,
    borderColor: colorPrimary,
    borderWidth: 1
  });
  page.drawText('TOTAL A PAGAR:', { x: tLabelX, y: y + 2, size: 9, font: fontBold, color: colorPrimary });
  page.drawText(totalStr, { x: tValX - fontBold.widthOfTextAtSize(totalStr, 9), y: y + 2, size: 9, font: fontBold, color: colorPrimary });

  y -= 40;

  // --- PIE DE PAGINA / NOTAS ---
  page.drawText('Ley de Impuesto al Valor Agregado - Factura Electronica', {
    x: pageWidth / 2,
    y: margin + 30,
    size: 7,
    font: font,
    color: colorGray,
    alignment: 'center'
  });

  page.drawText('Muchas gracias por hacer negocios con nosotros!', {
    x: pageWidth / 2,
    y: margin + 15,
    size: 8,
    font: fontBold,
    color: colorPrimary,
    alignment: 'center'
  });

  // Código de barras PDF-417 simulado
  const barcodeWidth = 140;
  const barcodeHeight = 25;
  const barcodeX = pageWidth / 2 - (barcodeWidth / 2);
  const barcodeY = margin + 45;

  page.drawRectangle({
    x: barcodeX,
    y: barcodeY,
    width: barcodeWidth,
    height: barcodeHeight,
    color: rgb(0.93, 0.93, 0.93),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5
  });

  // Líneas decorativas de barras
  let bx = barcodeX + 5;
  while (bx < barcodeX + barcodeWidth - 5) {
    const bw = Math.random() > 0.5 ? 2.5 : 1;
    page.drawRectangle({
      x: bx,
      y: barcodeY + 2,
      width: bw,
      height: barcodeHeight - 4,
      color: rgb(0.15, 0.15, 0.15)
    });
    bx += bw + (Math.random() > 0.4 ? 1.5 : 3);
  }
}

module.exports = {
  generateInvoicePdf
};
