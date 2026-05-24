const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function testPdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  page.drawText('Test', { x: 50, y: 500, size: 24, font, color: rgb(0,0,0) });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test.pdf', pdfBytes);
  console.log('PDF saved, size:', fs.statSync('test.pdf').size);
}
testPdf().catch(console.error);
