/**
 * Ecosistema Copilot 🤖 - Controlador del Asistente Virtual con IA
 */

const Copilot = (() => {
  'use strict';

  // Historial de conversación en la sesión actual
  let chatHistory = [];
  let isWindowOpen = false;

  // HTML inyectable del widget
  const WIDGET_HTML = `
    <div id="copilot-widget">
      <!-- Ventana de Chat -->
      <div class="copilot-chat-window" id="copilot-chat-window">
        <!-- Cabecera -->
        <div class="copilot-chat-header">
          <div class="copilot-avatar">🤖</div>
          <div class="copilot-info">
            <h4 class="copilot-name">Copilot Asistente</h4>
            <p class="copilot-status">En línea</p>
          </div>
          <button class="copilot-close" id="copilot-close-btn" title="Cerrar chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Cuerpo de mensajes -->
        <div class="copilot-chat-body" id="copilot-chat-body">
          <div class="copilot-message assistant">
            ¡Hola! Soy Copilot, tu asistente de IA. ¿Cómo puedo ayudarte hoy? 
            Puedo resolver tus dudas sobre el ecosistema o ayudarte a preparar facturas y documentos de prueba.
          </div>
        </div>

        <!-- Sugerencias Rápidas -->
        <div class="copilot-suggestions">
          <div class="copilot-chip" data-msg="ayuda">📋 Ayuda</div>
          <div class="copilot-chip" data-msg="factura demo">🧾 Factura Demo</div>
          <div class="copilot-chip" data-msg="como uso DocPlant">🌱 DocPlant</div>
          <div class="copilot-chip" data-msg="crea una factura">💡 Crear Factura</div>
        </div>

        <!-- Footer / Entrada de mensaje -->
        <div class="copilot-chat-footer">
          <input type="text" class="copilot-input" id="copilot-input" placeholder="Pregúntame algo..." autocomplete="off">
          <button class="copilot-send" id="copilot-send-btn" title="Enviar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      <!-- Burbuja flotante de activación -->
      <div class="copilot-bubble" id="copilot-bubble" title="Preguntar al asistente de IA">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-chat">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
    </div>
  `;

  /**
   * Inicializa el widget del Asistente
   */
  function init() {
    // 1. Inyectar estilos en el DOM si no están cargados
    if (!document.getElementById('copilot-css-link')) {
      const link = document.createElement('link');
      link.id = 'copilot-css-link';
      link.rel = 'stylesheet';
      link.href = 'css/copilot.css?v=2';
      document.head.appendChild(link);
    }

    // 2. Inyectar el HTML del widget en el body
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = WIDGET_HTML;
    document.body.appendChild(widgetContainer.firstElementChild);

    // 3. Registrar eventos del widget
    const bubble = document.getElementById('copilot-bubble');
    const closeBtn = document.getElementById('copilot-close-btn');
    const sendBtn = document.getElementById('copilot-send-btn');
    const chatInput = document.getElementById('copilot-input');
    const suggestions = document.querySelectorAll('.copilot-chip');

    bubble.addEventListener('click', toggleChatWindow);
    closeBtn.addEventListener('click', toggleChatWindow);

    sendBtn.addEventListener('click', handleUserSendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleUserSendMessage();
      }
    });

    suggestions.forEach(chip => {
      chip.addEventListener('click', () => {
        const msg = chip.getAttribute('data-msg');
        chatInput.value = msg;
        handleUserSendMessage();
      });
    });

    // 4. Registrar receptor de auto-llenado (si estamos en facturacion.html)
    checkAndProcessIncomingCopilotActions();
  }

  /**
   * Abre o cierra la ventana de chat
   */
  function toggleChatWindow() {
    const chatWindow = document.getElementById('copilot-chat-window');
    const bubble = document.getElementById('copilot-bubble');
    
    isWindowOpen = !isWindowOpen;

    if (isWindowOpen) {
      chatWindow.classList.add('active');
      bubble.classList.add('active');
      document.getElementById('copilot-input').focus();
    } else {
      chatWindow.classList.remove('active');
      bubble.classList.remove('active');
    }
  }

  /**
   * Agrega un mensaje visualmente al chat
   * @param {string} sender 'user' o 'assistant'
   * @param {string} text Texto del mensaje
   */
  function appendMessage(sender, text) {
    const chatBody = document.getElementById('copilot-chat-body');
    const msgElement = document.createElement('div');
    msgElement.className = `copilot-message ${sender}`;
    
    // Convertir saltos de línea y negritas en markdown simples a HTML
    const formattedText = text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    msgElement.innerHTML = formattedText;
    chatBody.appendChild(msgElement);
    
    // Auto-scroll al fondo
    chatBody.scrollTop = chatBody.scrollHeight;

    // Registrar en el historial en memoria
    chatHistory.push({ sender, text });
  }

  /**
   * Muestra u oculta el indicador animado de escritura
   * @param {boolean} show
   */
  function toggleTypingIndicator(show) {
    const chatBody = document.getElementById('copilot-chat-body');
    const existing = document.getElementById('copilot-typing-indicator');

    if (show && !existing) {
      const indicator = document.createElement('div');
      indicator.id = 'copilot-typing-indicator';
      indicator.className = 'copilot-typing';
      indicator.innerHTML = `
        <div class="copilot-dot"></div>
        <div class="copilot-dot"></div>
        <div class="copilot-dot"></div>
      `;
      chatBody.appendChild(indicator);
      chatBody.scrollTop = chatBody.scrollHeight;
    } else if (!show && existing) {
      existing.remove();
    }
  }

  /**
   * Manejador de envío de mensaje por el usuario
   */
  async function handleUserSendMessage() {
    const chatInput = document.getElementById('copilot-input');
    const text = chatInput.value.trim();
    if (!text) return;

    // Limpiar input
    chatInput.value = '';

    // Dibujar mensaje del usuario
    appendMessage('user', text);

    // Activar animación escribiendo
    toggleTypingIndicator(true);

    try {
      // Petición al backend
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') ? 'Bearer ' + localStorage.getItem('token') : ''
        },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-5) // Enviar solo últimos mensajes para optimizar
        })
      });

      const res = await response.json();
      toggleTypingIndicator(false);

      if (res.success) {
        // Mostrar respuesta de la IA
        appendMessage('assistant', res.reply);

        // Si la IA generó una acción de llenado de factura
        if (res.action && res.action.type === 'create_invoice') {
          drawActionCard(res.action);
        }
      } else {
        appendMessage('assistant', 'Lo siento, tuve un problema al procesar tu consulta en el servidor.');
      }
    } catch (error) {
      toggleTypingIndicator(false);
      console.error(error);
      appendMessage('assistant', 'Error de red. Asegúrate de que el servidor esté en línea.');
    }
  }

  /**
   * Dibuja la tarjeta interactiva de auto-llenado de factura en el chat
   */
  function drawActionCard(action) {
    const chatBody = document.getElementById('copilot-chat-body');
    const card = document.createElement('div');
    card.className = 'copilot-action-card';

    const clientName = action.data.client ? action.data.client.name : 'Cliente';
    card.innerHTML = `
      <p>📝 Datos de Factura listos para cargar (${clientName})</p>
      <button class="copilot-action-btn">Cargar en FacturAI</button>
    `;

    card.querySelector('.copilot-action-btn').addEventListener('click', () => {
      // Guardar la acción en localStorage
      localStorage.setItem('copilot_pending_action', JSON.stringify(action));
      
      // Comprobar si estamos en facturacion.html, si no, redirigir
      if (window.location.pathname.includes('facturacion.html')) {
        checkAndProcessIncomingCopilotActions();
      } else {
        // Redirigir a facturación
        window.location.href = 'facturacion.html';
      }
    });

    chatBody.appendChild(card);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /**
   * Verifica si hay alguna acción pendiente de rellenado en localStorage
   * y la inyecta reactivamente en el formulario
   */
  function checkAndProcessIncomingCopilotActions() {
    const rawAction = localStorage.getItem('copilot_pending_action');
    if (!rawAction) return;

    // Validar que estemos en facturacion.html para poder inyectar
    if (!window.location.pathname.includes('facturacion.html')) return;

    try {
      const action = JSON.parse(rawAction);
      
      if (action && action.type === 'create_invoice' && action.data) {
        // Esperar a que el script de facturacion.js esté listo
        // Buscamos si existe la estructura de formulario cargada
        setTimeout(() => {
          fillInvoiceForm(action.data);
          // Limpiar la acción de localStorage
          localStorage.removeItem('copilot_pending_action');
        }, 300);
      }
    } catch (e) {
      console.error('Error parseando acción del Copilot:', e);
    }
  }

  /**
   * Auto-rellena todos los campos e ítems del formulario en facturacion.html
   */
  function fillInvoiceForm(data) {
    // Localizar inputs del DOM
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

    // Cargar valores de campos directos
    if (inputInvoiceNumber && data.invoiceNumber) inputInvoiceNumber.value = data.invoiceNumber;
    if (selectCurrency && data.currency) selectCurrency.value = data.currency;
    if (inputDate && data.date) inputDate.value = data.date;
    if (inputDueDate && data.dueDate) inputDueDate.value = data.dueDate;
    if (inputPaymentMethod && data.paymentMethod) inputPaymentMethod.value = data.paymentMethod;

    if (data.issuer) {
      if (inputIssuerName && data.issuer.name) inputIssuerName.value = data.issuer.name;
      if (inputIssuerTaxId && data.issuer.taxId) inputIssuerTaxId.value = data.issuer.taxId;
      if (inputIssuerAddress && data.issuer.address) inputIssuerAddress.value = data.issuer.address;
      if (inputIssuerPhone && data.issuer.phone) inputIssuerPhone.value = data.issuer.phone;
      if (inputIssuerEmail && data.issuer.email) inputIssuerEmail.value = data.issuer.email;
    }

    if (data.client) {
      if (inputClientName && data.client.name) inputClientName.value = data.client.name;
      if (inputClientTaxId && data.client.taxId) inputClientTaxId.value = data.client.taxId;
      if (inputClientAddress && data.client.address) inputClientAddress.value = data.client.address;
      if (inputClientPhone && data.client.phone) inputClientPhone.value = data.client.phone;
      if (inputClientEmail && data.client.email) inputClientEmail.value = data.client.email;
    }

    // Forzar la recarga del objeto en memoria en facturacion.js
    // El script facturacion.js usa un listener sobre los campos para rellenar
    // Lanzamos eventos 'input' de forma programática en todos los campos cargados para que se actualice de forma reactiva
    const triggerInputEvent = (element) => {
      if (element) element.dispatchEvent(new Event('input', { bubbles: true }));
    };

    [
      inputInvoiceNumber, selectCurrency, inputDate, inputDueDate, inputPaymentMethod,
      inputIssuerName, inputIssuerTaxId, inputIssuerAddress, inputIssuerPhone, inputIssuerEmail,
      inputClientName, inputClientTaxId, inputClientAddress, inputClientPhone, inputClientEmail
    ].forEach(triggerInputEvent);

    // Cargar productos en la tabla. Para hacer esto con total compatibilidad,
    // inyectamos los ítems en el editor usando la interfaz.
    // facturacion.js tiene el objeto `currentInvoice` en memoria, pero está encapsulado.
    // Sin embargo, podemos comunicarnos con él forzando un click en el botón "+ Añadir ítem"
    // o reescribiendo la tabla. Para que sea completamente limpio y compatible:
    // Disparamos un evento de recarga. Como facturacion.js inicializa al cargar, lo ideal es
    // forzar la actualización de su variable currentInvoice en memoria.
    // Podemos crear un evento global personalizado 'copilotFill' al cual facturacion.js se subscriba.
    // ¡Esta es una solución de arquitectura espectacular!
    const fillEvent = new CustomEvent('copilotInvoiceFill', { detail: data });
    window.dispatchEvent(fillEvent);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('¡Datos de la factura cargados desde el asistente Copilot con éxito!', 'success');
    }
  }

  return {
    init
  };
})();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', Copilot.init);
