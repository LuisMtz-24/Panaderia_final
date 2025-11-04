// Referencias DOM
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const toggleLink = document.getElementById('toggleLink');
const toggleText = document.getElementById('toggleText');
const loginMensaje = document.getElementById('loginMensaje');
const registerMensaje = document.getElementById('registerMensaje');

let isLoginMode = true;

// Toggle entre login y registro
toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;

  if (isLoginMode) {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    toggleText.innerHTML = '¿No tienes cuenta? <a href="#" id="toggleLink">Regístrate aquí</a>';
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    toggleText.innerHTML = '¿Ya tienes cuenta? <a href="#" id="toggleLink">Inicia sesión aquí</a>';
  }

  // Limpiar mensajes
  loginMensaje.textContent = '';
  registerMensaje.textContent = '';
  loginMensaje.style.padding = '0';
  registerMensaje.style.padding = '0';

  // Re-asignar evento al nuevo link
  document.getElementById('toggleLink').addEventListener('click', arguments.callee);
});

// Manejar login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showMessage(loginMensaje, '❌ Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
      showMessage(loginMensaje, '✅ ' + data.mensaje, 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } else {
      showMessage(loginMensaje, '❌ ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error en login:', error);
    showMessage(loginMensaje, '❌ Error de conexión con el servidor', 'error');
  }
});

// Manejar registro
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const nombre_completo = document.getElementById('regNombre').value.trim();
  const email = document.getElementById('regEmail').value.trim();

  if (!username || !password) {
    showMessage(registerMensaje, '❌ Usuario y contraseña son obligatorios', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage(registerMensaje, '❌ La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        password, 
        nombre_completo, 
        email 
      })
    });

    const data = await res.json();

    if (res.ok) {
      showMessage(registerMensaje, '✅ ' + data.mensaje, 'success');
      registerForm.reset();
      
      setTimeout(() => {
        // Auto-cambiar a login
        toggleLink.click();
        showMessage(loginMensaje, '✅ Ahora puedes iniciar sesión', 'success');
      }, 1500);
    } else {
      showMessage(registerMensaje, '❌ ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error en registro:', error);
    showMessage(registerMensaje, '❌ Error de conexión con el servidor', 'error');
  }
});

// Función para mostrar mensajes
function showMessage(element, message, type) {
  element.textContent = message;
  element.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
  element.style.color = type === 'success' ? '#155724' : '#721c24';
  element.style.padding = '0.75rem';
  element.style.borderRadius = '8px';
  element.style.marginTop = '1rem';
  element.style.display = 'block';

  if (type !== 'success') {
    setTimeout(() => {
      element.textContent = '';
      element.style.padding = '0';
    }, 5000);
  }
}

// Verificar si ya hay sesión activa
async function checkExistingSession() {
  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();

    if (data.authenticated) {
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
  }
}

checkExistingSession();