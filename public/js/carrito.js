// Referencias DOM
const cartLayout = document.getElementById('cartLayout');
const emptyCart = document.getElementById('emptyCart');
const loadingCart = document.getElementById('loadingCart');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const subtotalElement = document.getElementById('subtotal');
const shippingElement = document.getElementById('shipping');
const totalElement = document.getElementById('total');
const clearCartBtn = document.getElementById('clearCartBtn');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const checkoutForm = document.getElementById('checkoutForm');
const toast = document.getElementById('toast');
const cartBadge = document.getElementById('cartBadge');
const authLink = document.getElementById('authLink');

let cartItems = [];
let isAuthenticated = false;

// Inicializar
async function init() {
  await checkAuth();
  if (isAuthenticated) {
    await loadCart();
  }
}

// Verificar autenticación
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    
    if (!data.authenticated) {
      showToast('⚠️ Debes iniciar sesión para ver tu carrito', 'error');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
      return;
    }
    
    isAuthenticated = true;
    authLink.textContent = 'Salir';
    authLink.href = '#';
    authLink.addEventListener('click', logout);
  } catch (error) {
    console.error('Error verificando auth:', error);
    window.location.href = '/login.html';
  }
}

// Cerrar sesión
async function logout(e) {
  e.preventDefault();
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// Cargar carrito
async function loadCart() {
  try {
    loadingCart.style.display = 'block';
    cartLayout.style.display = 'none';
    emptyCart.style.display = 'none';

    const res = await fetch('/api/carrito');
    if (!res.ok) {
      throw new Error('Error al cargar carrito');
    }
    
    cartItems = await res.json();

    loadingCart.style.display = 'none';

    if (cartItems.length === 0) {
      emptyCart.style.display = 'block';
      updateCartBadge(0);
      return;
    }

    cartLayout.style.display = 'grid';
    displayCartItems();
    updateTotals();
    updateCartBadge();

  } catch (error) {
    console.error('Error cargando carrito:', error);
    loadingCart.textContent = '❌ Error al cargar el carrito';
    loadingCart.style.color = 'red';
  }
}

// Mostrar items del carrito
function displayCartItems() {
  cartItemsContainer.innerHTML = cartItems.map(item => `
    <div class="cart-item" data-cart-id="${item.id_carrito}">
      <div class="cart-item-image" 
           style="background-image: url('${item.imagen_url || '/images/default-pan.jpg'}')">
      </div>
      
      <div class="cart-item-details">
        <h3>${item.nombre}</h3>
        <p class="cart-item-price">Precio unitario: $${parseFloat(item.precio).toFixed(2)}</p>
        ${item.temporada && item.temporada !== 'regular' ? 
          `<span class="badge badge-${item.temporada}">${getTemporadaIcon(item.temporada)} ${getTemporadaName(item.temporada)}</span>` 
          : ''}
        <p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
          Stock disponible: ${item.stock_disponible || 0}
        </p>
      </div>

      <div class="cart-item-quantity">
        <button class="qty-btn" onclick="updateQuantity(${item.id_carrito}, ${item.cantidad - 1}, ${item.stock_disponible || 0})">-</button>
        <span class="qty-display">${item.cantidad}</span>
        <button class="qty-btn" onclick="updateQuantity(${item.id_carrito}, ${item.cantidad + 1}, ${item.stock_disponible || 0})">+</button>
      </div>

      <div class="cart-item-subtotal">
        <div class="subtotal-label">Subtotal</div>
        <div class="subtotal-amount">$${parseFloat(item.subtotal).toFixed(2)}</div>
      </div>

      <button class="cart-item-remove" onclick="removeItem(${item.id_carrito})" title="Eliminar">
        ❌
      </button>
    </div>
  `).join('');
}

// Actualizar cantidad
async function updateQuantity(idCarrito, newQuantity, stockDisponible) {
  if (newQuantity <= 0) {
    removeItem(idCarrito);
    return;
  }

  if (newQuantity > stockDisponible) {
    showToast(`❌ Solo hay ${stockDisponible} unidades disponibles`, 'error');
    return;
  }

  try {
    const res = await fetch(`/api/carrito/${idCarrito}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: newQuantity })
    });

    if (res.ok) {
      await loadCart();
      showToast('✅ Cantidad actualizada', 'success');
    } else {
      const data = await res.json();
      showToast('❌ ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    showToast('❌ Error de conexión', 'error');
  }
}

// Eliminar item
async function removeItem(idCarrito) {
  if (!confirm('¿Eliminar este producto del carrito?')) return;

  try {
    const res = await fetch(`/api/carrito/${idCarrito}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      await loadCart();
      showToast('✅ Producto eliminado', 'success');
    } else {
      const data = await res.json();
      showToast('❌ ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error eliminando item:', error);
    showToast('❌ Error de conexión', 'error');
  }
}

// Vaciar carrito
clearCartBtn.addEventListener('click', async () => {
  if (!confirm('¿Vaciar todo el carrito?')) return;

  try {
    const res = await fetch('/api/carrito/vaciar/todo', {
      method: 'DELETE'
    });

    if (res.ok) {
      await loadCart();
      showToast('✅ Carrito vaciado', 'success');
    } else {
      showToast('❌ Error al vaciar carrito', 'error');
    }
  } catch (error) {
    console.error('Error vaciando carrito:', error);
    showToast('❌ Error de conexión', 'error');
  }
});

// Actualizar totales
function updateTotals() {
  const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
  const shipping = 50.00;
  const total = subtotal + shipping;

  subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  shippingElement.textContent = `$${shipping.toFixed(2)}`;
  totalElement.textContent = `$${total.toFixed(2)}`;
}

// Checkout
checkoutBtn.addEventListener('click', () => {
  const totalItems = cartItems.reduce((sum, item) => sum + item.cantidad, 0);
  const total = cartItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0) + 50;

  document.getElementById('modalItemsCount').textContent = totalItems;
  document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
  
  checkoutModal.style.display = 'block';
});

// Procesar checkout
checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    direccion: document.getElementById('direccion').value.trim(),
    ciudad: document.getElementById('ciudad').value.trim(),
    codigo_postal: document.getElementById('codigoPostal').value.trim(),
    metodo_pago: document.getElementById('metodoPago').value,
    notas: document.getElementById('notas').value.trim()
  };

  if (!formData.direccion || !formData.ciudad || !formData.codigo_postal || !formData.metodo_pago) {
    showMessage('checkoutMessage', '❌ Por favor completa todos los campos obligatorios', 'error');
    return;
  }

  // Aquí iría la lógica para crear el pedido
  // Por ahora solo mostramos un mensaje de éxito
  showMessage('checkoutMessage', '✅ ¡Pedido realizado con éxito!', 'success');
  
  setTimeout(async () => {
    await fetch('/api/carrito/vaciar/todo', { method: 'DELETE' });
    checkoutModal.style.display = 'none';
    checkoutForm.reset();
    showToast('✅ ¡Gracias por tu compra! Tu pedido está en proceso.', 'success');
    await loadCart();
  }, 2000);
});

// Modal controls
const closeModal = document.querySelector('.close');
const cancelCheckout = document.getElementById('cancelCheckout');

if (closeModal) {
  closeModal.addEventListener('click', () => {
    checkoutModal.style.display = 'none';
  });
}

if (cancelCheckout) {
  cancelCheckout.addEventListener('click', () => {
    checkoutModal.style.display = 'none';
  });
}

window.onclick = (e) => {
  if (e.target === checkoutModal) {
    checkoutModal.style.display = 'none';
  }
};

// Actualizar badge
async function updateCartBadge(count = null) {
  if (count !== null) {
    if (cartBadge) {
      cartBadge.textContent = count;
      cartBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    return;
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.cantidad, 0);
  if (cartBadge) {
    cartBadge.textContent = totalItems;
    cartBadge.style.display = totalItems > 0 ? 'inline-block' : 'none';
  }
}

// Utilidades
function getTemporadaIcon(temporada) {
  const icons = {
    'halloween': '🎃',
    'dia_muertos': '💀',
    'navidad': '🎄',
    'regular': '🥖'
  };
  return icons[temporada] || '🥖';
}

function getTemporadaName(temporada) {
  const names = {
    'halloween': 'Halloween',
    'dia_muertos': 'Día de Muertos',
    'navidad': 'Navidad',
    'regular': 'Regular'
  };
  return names[temporada] || 'Regular';
}

function showToast(message, type = 'info') {
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.add('toast-show');
  
  setTimeout(() => {
    toast.classList.remove('toast-show');
  }, 3000);
}

function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = message;
  element.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
  element.style.color = type === 'success' ? '#155724' : '#721c24';
  element.style.padding = '0.75rem';
  element.style.borderRadius = '8px';
  element.style.marginTop = '1rem';
  element.style.display = 'block';
}

// Hacer funciones globales
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;

// Inicializar cuando cargue la página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}