document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const errorMsg = document.getElementById('error-msg');
  const loginBtn = document.getElementById('login-btn');

  // Si ya hay token de admin, redirigir al dashboard
  const token = localStorage.getItem('adminToken');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role === 'admin') {
        window.location.href = 'index.html';
      }
    } catch(e) {
      // Token inválido, limpiar
      localStorage.removeItem('adminToken');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    errorMsg.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Autenticando...';
    
    // --- BYPASS DE EMERGENCIA 100% FRONTEND ---
    if ((email.toLowerCase() === 'reyes@hotmail.com' && password === '123456JR') || (email.toLowerCase() === 'admin' && password === 'admin') || (email.toLowerCase() === 'admin@admin.com' && password === 'admin')) {
      // Crear un token falso pero válido para el frontend
      // Formato: header.payload.signature (base64)
      const fakePayload = btoa(JSON.stringify({ role: 'admin', email: email }));
      const fakeToken = `fakeHeader.${fakePayload}.fakeSignature`;
      
      localStorage.setItem('adminToken', fakeToken);
      window.location.href = 'index.html';
      return;
    }
    // -------------------------------------------
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Verificar que sea realmente admin
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        if (payload.role !== 'admin') {
          errorMsg.textContent = 'Acceso denegado. Esta cuenta no tiene permisos de administrador.';
          errorMsg.style.display = 'block';
          loginBtn.disabled = false;
          loginBtn.textContent = 'Acceder al Panel';
          return;
        }
        
        // Guardar credenciales como admin
        localStorage.setItem('adminToken', data.token);
        
        // Redirigir al dashboard
        window.location.href = 'index.html';
      } else {
        errorMsg.textContent = data.message || 'Credenciales incorrectas.';
        errorMsg.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Acceder al Panel';
      }
    } catch (error) {
      console.error('Error de red:', error);
      errorMsg.textContent = 'Error de conexión con el servidor.';
      errorMsg.style.display = 'block';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Acceder al Panel';
    }
  });
});
