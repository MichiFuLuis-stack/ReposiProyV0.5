/**
 * FacturAI 🧾 - Controlador Frontend del Módulo de Facturación
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar objeto de factura en memoria
  let currentInvoice = {
    invoiceNumber: 'FAC-' + Math.floor(100000 + Math.random() * 900000),
    date: new Date().toISOString().split('T')[0],
    dueDate: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })(),
    currency: 'CLP',
    issuer: {
      name: 'Proveedor de Servicios S.A.',
      taxId: '76.123.456-K',
      address: 'Av. Andres Bello 1234, Providencia, Santiago',
      phone: '+56 2 2123 4567',
      email: 'contacto@proveedor.cl'
    },
    client: {
      name: 'Cliente Final S.A.',
      taxId: '99.555.666-8',
      address: 'Calle Nueva York 45, Santiago Centro',
      phone: '+56 2 2987 6543',
      email: 'facturas@clientefinal.cl'
    },
    items: [
      { description: 'Desarrollo de Software a Medida', quantity: 1, unitPrice: 1500000, total: 1500000 },
      { description: 'Soporte y Mantenimiento Cloud mensual', quantity: 2, unitPrice: 250000, total: 500000 }
    ],
    subtotal: 2000000,
    taxRate: 0.19, // IVA 19%
    taxAmount: 380000,
    total: 2380000,
    paymentMethod: 'Transferencia Bancaria'
  };

  // Elementos del DOM Pestañas previsualizador
  const btnPreviewLetter = document.getElementById('btn-preview-letter');
  const btnPreviewPos = document.getElementById('btn-preview-pos');
  const viewLetter = document.getElementById('view-letter');
  const viewPos = document.getElementById('view-pos');
  let activeFormat = 'letter'; // 'letter' o 'pos'

  // Inputs del editor
  const inputInvoiceNumber = document.getElementById('invoice-number');
  const selectCurrency = document.getElementById('invoice-currency');
  const inputDate = document.getElementById('invoice-date');
  const inputDueDate = document.getElementById('invoice-due-date');
  const inputPaymentMethod = document.getElementById('invoice-payment-method');

  const inputIssuerName = document.getElementById('issuer-name');
  const inputIssuerTaxId = document.getElementById('issuer-tax-id');
  const inputIssuerAddress = document.getElementById('issuer-address');
  const inputIssuerPhone = document.getElementById('issuer-phone');
  const inputIssuerEmail = document.getElementById('issuer-email');

  const inputClientName = document.getElementById('client-name');
  const inputClientTaxId = document.getElementById('client-tax-id');
  const inputClientAddress = document.getElementById('client-address');
  const inputClientPhone = document.getElementById('client-phone');
  const inputClientEmail = document.getElementById('client-email');

  const inputTaxRate = document.getElementById('tax-rate-input');
  
  // Elementos de totales en editor
  const editorSubtotal = document.getElementById('editor-subtotal-val');
  const editorTax = document.getElementById('editor-tax-val');
  const editorTotal = document.getElementById('editor-total-val');

  // Botones de acción
  const btnAddItem = document.getElementById('btn-add-item');
  const btnResetInvoice = document.getElementById('btn-reset-invoice');
  const btnGenerateLetter = document.getElementById('btn-generate-letter');
  const btnGeneratePos = document.getElementById('btn-generate-pos');
  const btnPrintDirect = document.getElementById('btn-print-direct');

  // Inicializar formulario con los datos por defecto
  function initFormFields() {
    inputInvoiceNumber.value = currentInvoice.invoiceNumber;
    selectCurrency.value = currentInvoice.currency;
    inputDate.value = currentInvoice.date;
    inputDueDate.value = currentInvoice.dueDate;
    inputPaymentMethod.value = currentInvoice.paymentMethod;

    inputIssuerName.value = currentInvoice.issuer.name;
    inputIssuerTaxId.value = currentInvoice.issuer.taxId;
    inputIssuerAddress.value = currentInvoice.issuer.address;
    inputIssuerPhone.value = currentInvoice.issuer.phone || '';
    inputIssuerEmail.value = currentInvoice.issuer.email || '';

    inputClientName.value = currentInvoice.client.name;
    inputClientTaxId.value = currentInvoice.client.taxId;
    inputClientAddress.value = currentInvoice.client.address;
    inputClientPhone.value = currentInvoice.client.phone || '';
    inputClientEmail.value = currentInvoice.client.email || '';

    inputTaxRate.value = Math.round(currentInvoice.taxRate * 100);
  }

  // --- LÓGICA DE ACTUALIZACIÓN REACTIVA ---

  // Escuchar cambios en los inputs del documento/emisor/cliente
  const bindInputEvent = (inputElement, callback) => {
    inputElement.addEventListener('input', (e) => {
      callback(e.target.value);
      recalculateTotals();
      renderPreview();
    });
  };

  bindInputEvent(inputInvoiceNumber, val => currentInvoice.invoiceNumber = val);
  bindInputEvent(selectCurrency, val => currentInvoice.currency = val);
  bindInputEvent(inputDate, val => currentInvoice.date = val);
  bindInputEvent(inputDueDate, val => currentInvoice.dueDate = val);
  bindInputEvent(inputPaymentMethod, val => currentInvoice.paymentMethod = val);

  bindInputEvent(inputIssuerName, val => currentInvoice.issuer.name = val);
  bindInputEvent(inputIssuerTaxId, val => currentInvoice.issuer.taxId = val);
  bindInputEvent(inputIssuerAddress, val => currentInvoice.issuer.address = val);
  bindInputEvent(inputIssuerPhone, val => currentInvoice.issuer.phone = val);
  bindInputEvent(inputIssuerEmail, val => currentInvoice.issuer.email = val);

  bindInputEvent(inputClientName, val => currentInvoice.client.name = val);
  bindInputEvent(inputClientTaxId, val => currentInvoice.client.taxId = val);
  bindInputEvent(inputClientAddress, val => currentInvoice.client.address = val);
  bindInputEvent(inputClientPhone, val => currentInvoice.client.phone = val);
  bindInputEvent(inputClientEmail, val => currentInvoice.client.email = val);

  // IVA
  inputTaxRate.addEventListener('input', (e) => {
    const percent = parseFloat(e.target.value) || 0;
    currentInvoice.taxRate = percent / 100;
    recalculateTotals();
    renderPreview();
  });

  // Formatear dinero según moneda
  function formatMoney(value) {
    if (currentInvoice.currency === 'CLP') {
      return '$' + Math.round(value).toLocaleString('es-CL');
    }
    return '$' + parseFloat(value).toFixed(2).toLocaleString('en-US');
  }

  // Recalcular subtotales e impuestos
  function recalculateTotals() {
    let subtotal = 0;
    currentInvoice.items.forEach(item => {
      item.total = item.quantity * item.unitPrice;
      subtotal += item.total;
    });

    currentInvoice.subtotal = subtotal;
    currentInvoice.taxAmount = Math.round(subtotal * currentInvoice.taxRate);
    currentInvoice.total = subtotal + currentInvoice.taxAmount;

    // Actualizar editor de totales
    editorSubtotal.textContent = formatMoney(currentInvoice.subtotal);
    editorTax.textContent = formatMoney(currentInvoice.taxAmount);
    editorTotal.textContent = formatMoney(currentInvoice.total);
  }

  // Renderizar la tabla de productos en el editor (Panel derecho)
  function renderEditorItems() {
    const listContainer = document.getElementById('editor-items-list');
    listContainer.innerHTML = '';

    currentInvoice.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'editor-item-row';
      
      row.innerHTML = `
        <input type="text" class="input item-desc" placeholder="Descripción del producto/servicio" value="${item.description}">
        <input type="number" class="input item-qty" placeholder="Cant" min="1" value="${item.quantity}" style="text-align: center;">
        <input type="number" class="input item-price" placeholder="Precio" min="0" value="${item.unitPrice}">
        <button type="button" class="btn-delete-item" title="Eliminar ítem">🗑️</button>
      `;

      // Escuchar eventos en los inputs de este ítem
      const descInput = row.querySelector('.item-desc');
      const qtyInput = row.querySelector('.item-qty');
      const priceInput = row.querySelector('.item-price');
      const deleteBtn = row.querySelector('.btn-delete-item');

      descInput.addEventListener('input', (e) => {
        currentInvoice.items[index].description = e.target.value;
        renderPreview();
      });

      qtyInput.addEventListener('input', (e) => {
        currentInvoice.items[index].quantity = parseInt(e.target.value, 10) || 1;
        recalculateTotals();
        renderPreview();
      });

      priceInput.addEventListener('input', (e) => {
        currentInvoice.items[index].unitPrice = parseFloat(e.target.value) || 0;
        recalculateTotals();
        renderPreview();
      });

      deleteBtn.addEventListener('click', () => {
        // Impedir que se borren todos
        if (currentInvoice.items.length <= 1) {
          App.showToast('La factura debe tener al menos 1 producto o servicio.', 'error');
          return;
        }
        currentInvoice.items.splice(index, 1);
        recalculateTotals();
        renderEditorItems();
        renderPreview();
      });

      listContainer.appendChild(row);
    });
  }

  // --- LÓGICA DE PREVISUALIZACIÓN DE FACTURA (Papel en vivo) ---

  function renderPreview() {
    // Inyectar datos textuales comunes
    document.querySelectorAll('.preview-issuer-name').forEach(el => el.textContent = currentInvoice.issuer.name || 'EMISOR');
    document.querySelectorAll('.preview-issuer-tax-id').forEach(el => el.textContent = currentInvoice.issuer.taxId || 'RUT EMISOR');
    document.querySelectorAll('.preview-issuer-address').forEach(el => el.textContent = currentInvoice.issuer.address || '');
    document.querySelectorAll('.preview-issuer-phone').forEach(el => el.textContent = currentInvoice.issuer.phone ? 'Tel: ' + currentInvoice.issuer.phone : '');
    document.querySelectorAll('.preview-issuer-email').forEach(el => el.textContent = currentInvoice.issuer.email || '');

    document.querySelectorAll('.preview-invoice-num').forEach(el => el.textContent = currentInvoice.invoiceNumber || '---');
    document.querySelectorAll('.preview-date').forEach(el => el.textContent = currentInvoice.date || '---');
    document.querySelectorAll('.preview-due-date').forEach(el => el.textContent = currentInvoice.dueDate || '---');
    document.querySelectorAll('.preview-payment-method').forEach(el => el.textContent = currentInvoice.paymentMethod || 'Transferencia');
    document.querySelectorAll('.preview-currency').forEach(el => el.textContent = currentInvoice.currency);

    document.querySelectorAll('.preview-client-name').forEach(el => el.textContent = currentInvoice.client.name || 'CLIENTE');
    document.querySelectorAll('.preview-client-tax-id').forEach(el => el.textContent = currentInvoice.client.taxId || 'RUT CLIENTE');
    document.querySelectorAll('.preview-client-address').forEach(el => el.textContent = currentInvoice.client.address || '');

    document.querySelectorAll('.preview-tax-rate').forEach(el => el.textContent = Math.round(currentInvoice.taxRate * 100));

    // Formatear dinero
    const subtotalFormatted = formatMoney(currentInvoice.subtotal);
    const taxFormatted = formatMoney(currentInvoice.taxAmount);
    const totalFormatted = formatMoney(currentInvoice.total);

    document.querySelectorAll('.preview-subtotal').forEach(el => el.textContent = subtotalFormatted);
    document.querySelectorAll('.preview-tax-amount').forEach(el => el.textContent = taxFormatted);
    document.querySelectorAll('.preview-total').forEach(el => el.textContent = totalFormatted);

    // 1. Renderizar tabla de productos en formato Carta (Letter)
    const letterBody = document.getElementById('letter-items-body');
    letterBody.innerHTML = '';
    currentInvoice.items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid rgba(0,0,0,0.08);">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid rgba(0,0,0,0.08);">${item.description || 'Nuevo producto'}</td>
        <td style="padding: 8px; border-bottom: 1px solid rgba(0,0,0,0.08); text-align: right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding: 8px; border-bottom: 1px solid rgba(0,0,0,0.08); text-align: right; font-weight: 500;">${formatMoney(item.total)}</td>
      `;
      letterBody.appendChild(tr);
    });

    // 2. Renderizar lista de productos en formato POS (Ticket)
    const posList = document.getElementById('pos-items-list');
    posList.innerHTML = '';
    currentInvoice.items.forEach(item => {
      const rowItem = document.createElement('div');
      rowItem.className = 'pos-item-row';
      rowItem.innerHTML = `
        <span>${(item.description || 'Producto').substring(0, 20)}</span>
        <span>${formatMoney(item.total)}</span>
      `;
      
      const rowDetails = document.createElement('div');
      rowDetails.className = 'pos-item-details';
      rowDetails.textContent = `${item.quantity} x ${formatMoney(item.unitPrice)}`;

      posList.appendChild(rowItem);
      posList.appendChild(rowDetails);
    });
  }

  // --- CONTROLES DE LA VISTA PREVIA ---

  btnPreviewLetter.addEventListener('click', () => {
    activeFormat = 'letter';
    btnPreviewLetter.className = 'btn btn-sm btn-secondary active';
    btnPreviewPos.className = 'btn btn-sm btn-ghost';
    viewLetter.classList.remove('hidden');
    viewPos.classList.add('hidden');
  });

  btnPreviewPos.addEventListener('click', () => {
    activeFormat = 'pos';
    btnPreviewPos.className = 'btn btn-sm btn-secondary active';
    btnPreviewLetter.className = 'btn btn-sm btn-ghost';
    viewPos.classList.remove('hidden');
    viewLetter.classList.add('hidden');
  });

  // --- GESTIÓN DE ACCIONES DE LA FACTURA ---

  // Añadir ítem
  btnAddItem.addEventListener('click', () => {
    currentInvoice.items.push({
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    });
    renderEditorItems();
    renderPreview();
  });

  // Limpiar / Reiniciar
  btnResetInvoice.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que deseas limpiar la factura actual y reestablecer los valores por defecto?')) {
      currentInvoice.invoiceNumber = 'FAC-' + Math.floor(100000 + Math.random() * 900000);
      currentInvoice.date = new Date().toISOString().split('T')[0];
      currentInvoice.dueDate = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
      })();
      currentInvoice.items = [{ description: 'Servicios Generales', quantity: 1, unitPrice: 100000, total: 100000 }];
      
      initFormFields();
      recalculateTotals();
      renderEditorItems();
      renderPreview();
      App.showToast('Campos reestablecidos.', 'success');
    }
  });

  // --- GENERACIÓN Y DESCARGA DE PDFS ---

  async function generateInvoice(format) {
    App.showLoading('Generando documento PDF...');
    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') ? 'Bearer ' + localStorage.getItem('token') : ''
        },
        body: JSON.stringify({
          invoice: currentInvoice,
          format: format
        })
      });

      const res = await response.json();
      App.hideLoading();

      if (res.success && res.file) {
        App.showToast(`Factura PDF (${format.toUpperCase()}) generada con éxito. Iniciando descarga...`, 'success');
        
        // Disparar descarga nativa del archivo
        const downloadUrl = `/api/documents/${res.file.id}/download`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = res.file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        App.showToast(res.message || 'Error al generar la factura.', 'error');
      }
    } catch (error) {
      App.hideLoading();
      console.error(error);
      App.showToast('Error de conexión al generar la factura.', 'error');
    }
  }

  btnGenerateLetter.addEventListener('click', () => generateInvoice('letter'));
  btnGeneratePos.addEventListener('click', () => generateInvoice('pos'));

  // --- SISTEMA DE IMPRESIÓN DIRECTA ---

  btnPrintDirect.addEventListener('click', () => {
    // Definir la clase en el body según el formato activo del visualizador
    if (activeFormat === 'pos') {
      document.body.classList.add('print-pos-mode');
      document.body.classList.remove('print-letter-mode');
    } else {
      document.body.classList.add('print-letter-mode');
      document.body.classList.remove('print-pos-mode');
    }

    // Esperar un instante para que el navegador recalcule el CSS de impresión y llamar a print
    setTimeout(() => {
      window.print();
      
      // Limpiar clases al terminar (cuando se cierra el diálogo)
      document.body.classList.remove('print-pos-mode', 'print-letter-mode');
    }, 150);
  });

  // Suscripción al evento personalizado 'copilotInvoiceFill' de Copilot para auto-rellenar
  window.addEventListener('copilotInvoiceFill', (e) => {
    const data = e.detail;
    if (!data) return;

    // Actualizar currentInvoice con los nuevos datos
    if (data.invoiceNumber) currentInvoice.invoiceNumber = data.invoiceNumber;
    if (data.currency) currentInvoice.currency = data.currency;
    if (data.date) currentInvoice.date = data.date;
    if (data.dueDate) currentInvoice.dueDate = data.dueDate;
    if (data.paymentMethod) currentInvoice.paymentMethod = data.paymentMethod;

    if (data.issuer) {
      currentInvoice.issuer = { ...currentInvoice.issuer, ...data.issuer };
    }
    if (data.client) {
      currentInvoice.client = { ...currentInvoice.client, ...data.client };
    }
    if (data.items && Array.isArray(data.items)) {
      currentInvoice.items = data.items.map(item => ({
        description: item.description || 'Producto',
        quantity: parseInt(item.quantity, 10) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        total: (parseInt(item.quantity, 10) || 1) * (parseFloat(item.unitPrice) || 0)
      }));
    }

    // Volver a renderizar e inicializar
    initFormFields();
    recalculateTotals();
    renderEditorItems();
    renderPreview();
  });

  // Inicialización de la pantalla al cargar
  initFormFields();
  recalculateTotals();
  renderEditorItems();
  renderPreview();
});
