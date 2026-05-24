/**
 * Script de prueba para verificar la generación y el parseo de facturas (FacturAI)
 */

const fs = require('fs');
const path = require('path');
const { generateInvoicePdf } = require('./server/services/invoicePdfGenerator');
const { parseInvoiceText } = require('./server/services/invoiceParser');

const mockInvoice = {
  invoiceNumber: 'FAC-2026-9988',
  date: '2026-05-24',
  dueDate: '2026-06-24',
  currency: 'CLP',
  issuer: {
    name: 'Consultoría y Tecnologías Limitada',
    taxId: '76.999.888-K',
    address: 'Av. Vitacura 5000, Oficina 401, Vitacura, Santiago',
    phone: '+56 2 2999 8888',
    email: 'facturas@tecnologia.cl'
  },
  client: {
    name: 'Servicios de Alimentos S.A.',
    taxId: '88.777.666-4',
    address: 'Calle Apoquindo 4500, Las Condes, Santiago',
    phone: '+56 2 2777 6666',
    email: 'adquisiciones@alimentos.cl'
  },
  items: [
    { description: 'Licencia Anual Plataforma SaaS', quantity: 2, unitPrice: 450000, total: 900000 },
    { description: 'Servicios de Integración y API', quantity: 5, unitPrice: 80000, total: 400000 },
    { description: 'Capacitación del Personal (Jornada)', quantity: 1, unitPrice: 150000, total: 150000 }
  ],
  subtotal: 1450000,
  taxRate: 0.19, // IVA 19%
  taxAmount: 275500,
  total: 1725500,
  paymentMethod: 'Transferencia Bancaria a Cuenta Corriente'
};

async function runTests() {
  console.log('🏁 Iniciando pruebas de FacturAI...');

  // 1. Probar generación formato Carta
  try {
    console.log('📄 Generando factura tamaño Carta...');
    const letterBytes = await generateInvoicePdf(mockInvoice, 'letter');
    const letterPath = path.join(__dirname, 'test-invoice-letter.pdf');
    fs.writeFileSync(letterPath, letterBytes);
    console.log(`✅ Factura Carta guardada en: ${letterPath} (${letterBytes.length} bytes)`);
  } catch (error) {
    console.error('❌ Error generando factura Carta:', error);
  }

  // 2. Probar generación formato POS (Ticket 80mm)
  try {
    console.log('🧾 Generando ticket POS (80mm)...');
    const posBytes = await generateInvoicePdf(mockInvoice, 'pos');
    const posPath = path.join(__dirname, 'test-invoice-pos.pdf');
    fs.writeFileSync(posPath, posBytes);
    console.log(`✅ Ticket POS guardado en: ${posPath} (${posBytes.length} bytes)`);
  } catch (error) {
    console.error('❌ Error generando ticket POS:', error);
  }

  // 3. Probar analizador/parser de texto
  try {
    console.log('🔍 Probando analizador de texto de facturas...');
    const sampleText = `
      CONTRATISTA Y SERVICIOS LTDA.
      RUT: 76.555.444-3
      Av. Providencia 999, Santiago
      FACTURA ELECTRÓNICA Nº: 5042
      Fecha de emisión: 15/04/2026
      Fecha de Vencimiento: 15/05/2026
      CLIENTE: IMPORTADORA EXPRESS S.A.
      RUT CLIENTE: 99.111.222-K
      Dirección: Calle Estado 20, Santiago Centro
      Email: pagos@importadora.cl
      
      Detalle del documento:
      3 x Mouse Inalámbrico Pro   15000   45000
      1 x Teclado Mecánico RGB   45000   45000
      2 x Monitor LED 24 Pulgadas  120000  240000
      
      SUBTOTAL: 330000
      IVA (19%): 62700
      TOTAL GENERAL: 392700
      Metodo de Pago: Transferencia
    `;

    const parsed = parseInvoiceText(sampleText);
    console.log('✅ Texto analizado con éxito. Campos extraídos:');
    console.log(`   - Nº Factura: ${parsed.invoiceNumber}`);
    console.log(`   - Emisor: ${parsed.issuer.name} (RUT: ${parsed.issuer.taxId})`);
    console.log(`   - Cliente: ${parsed.client.name} (RUT: ${parsed.client.taxId})`);
    console.log(`   - Subtotal: ${parsed.subtotal}, IVA: ${parsed.taxAmount}, Total: ${parsed.total}`);
    console.log(`   - Cantidad de ítems: ${parsed.items.length}`);
    
    if (parsed.items.length === 3 && parsed.total === 392700) {
      console.log('🎉 El parseador funcionó a la perfección!');
    } else {
      console.warn('⚠️ El parseador extrajo los datos, pero algunos cálculos difieren de lo esperado.');
    }
  } catch (error) {
    console.error('❌ Error probando el analizador:', error);
  }

  console.log('🏁 Pruebas finalizadas.');
}

runTests();
