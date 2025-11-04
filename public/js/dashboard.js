// Referencias DOM
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const logoutBtn = document.getElementById('logoutBtn');
const adminSection = document.getElementById('adminSection');
const clientSection = document.getElementById('clientSection');
const addProductForm = document.getElementById('addProductForm');
const editProductForm = document.getElementById('editProductForm');
const editModal = document.getElementById('editModal');
const productsTableBody = document.getElementById('productsTableBody');
const filterTemporada = document.getElementById('filterTemporada');
const refreshBtn = document.getElementById('refreshBtn');

let currentUser = null;
let allCategories = [];

// Verificar autenticación
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/profile');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    
    currentUser = await res.json();
    userName.textContent = currentUser.username;
    userRole.textContent = currentUser.rol;
    
    if (currentUser.rol === 'admin') {
      adminSection.style.display = 'block';
      clientSection.style.display = 'none';
      loadCategories();
      loadProducts();
    } else {
      adminSection.style.display = 'none';
      clientSection.style.display = 'block';
    }
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    window.location.href = '/login.html';
  }
}

// Cerrar sesión
logoutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
});

// Cargar categorías
async function loadCategories() {
  try {
    const res = await fetch('/api/productos/categorias/list');
    allCategories = await res.json();
    
    const selectElements = [
      document.getElementById('categoria'),
      document.getElementById('editCategoria')
    ];
    
    selectElements.forEach(select => {
      select.innerHTML = '<option value="">Sin categoría</option>';
      allCategories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id_categoria}">${cat.nombre}</option>`;
      });
    });
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

// Cargar productos
async function loadProducts(temporada = '') {
  try {
    let url = '/api/productos';
    if (temporada) url += `?temporada=${temporada}`;
    
    const res = await fetch(url);
    const productos = await res.json();
    
    if (productos.length === 0) {
      productsTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center">No hay productos</td></tr>';
      return;
    }
    
    productsTableBody.innerHTML = productos.map(p => `
      <tr>
        <td>${p.id_producto}</td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.categoria_nombre || '-'}</td>
        <td>$${parseFloat(p.precio).toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>
          <span class="badge badge-${p.temporada}">
            ${getTemporadaIcon(p.temporada)} ${p.temporada}
          </span>
        </td>
        <td>
          <span class="badge badge-${p.activo ? 'success' : 'danger'}">
            ${p.activo ? '✅ Activo' : '❌ Inactivo'}
          </span>
        </td>
        <td class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="editProduct(${p.id_producto})">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id_producto})">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando productos:', error);
    productsTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red">Error al cargar productos</td></tr>';
  }
}

function getTemporadaIcon(temporada) {
  const icons = {
    'halloween': '🎃',
    'dia_muertos': '💀',
    'navidad': '🎄',
    'regular': '🥖'
  };
  return icons[temporada] || '🥖';
}

// Agregar producto
addProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    nombre: document.getElementById('nombre').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    precio: parseFloat(document.getElementById('precio').value),
    stock: parseInt(document.getElementById('stock').value),
    id_categoria: document.getElementById('categoria').value || null,
    temporada: document.getElementById('temporada').value,
    imagen_url: document.getElementById('imagen_url').value.trim() || null
  };
  
  try {
    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await res.json();
    
    if (res.ok) {
      showMessage('addMessage', '✅ ' + data.mensaje, 'success');
      addProductForm.reset();
      loadProducts();
    } else {
      showMessage('addMessage', '❌ ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error agregando producto:', error);
    showMessage('addMessage', '❌ Error de conexión', 'error');
  }
});

// Editar producto
window.editProduct = async function(id) {
  try {
    const res = await fetch(`/api/productos/${id}`);
    const producto = await res.json();
    
    document.getElementById('editId').value = producto.id_producto;
    document.getElementById('editNombre').value = producto.nombre;
    document.getElementById('editDescripcion').value = producto.descripcion || '';
    document.getElementById('editPrecio').value = producto.precio;
    document.getElementById('editStock').value = producto.stock;
    document.getElementById('editCategoria').value = producto.id_categoria || '';
    document.getElementById('editTemporada').value = producto.temporada;
    document.getElementById('editImagen').value = producto.imagen_url || '';
    document.getElementById('editActivo').checked = producto.activo;
    
    editModal.style.display = 'block';
  } catch (error) {
    console.error('Error cargando producto:', error);
    alert('❌ Error al cargar producto');
  }
};

editProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('editId').value;
  const formData = {
    nombre: document.getElementById('editNombre').value.trim(),
    descripcion: document.getElementById('editDescripcion').value.trim(),
    precio: parseFloat(document.getElementById('editPrecio').value),
    stock: parseInt(document.getElementById('editStock').value),
    id_categoria: document.getElementById('editCategoria').value || null,
    temporada: document.getElementById('editTemporada').value,
    imagen_url: document.getElementById('editImagen').value.trim() || null,
    activo: document.getElementById('editActivo').checked
  };
  
  try {
    const res = await fetch(`/api/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await res.json();
    
    if (res.ok) {
      showMessage('editMessage', '✅ ' + data.mensaje, 'success');
      setTimeout(() => {
        editModal.style.display = 'none';
        loadProducts();
      }, 1500);
    } else {
      showMessage('editMessage', '❌ ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error actualizando producto:', error);
    showMessage('editMessage', '❌ Error de conexión', 'error');
  }
});

// Eliminar producto
window.deleteProduct = async function(id) {
  if (!confirm('¿Estás seguro de eliminar este producto?')) return;
  
  try {
    const res = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (res.ok) {
      alert('✅ ' + data.mensaje);
      loadProducts();
    } else {
      alert('❌ ' + data.error);
    }
  } catch (error) {
    console.error('Error eliminando producto:', error);
    alert('❌ Error de conexión');
  }
};

// Modal controls
document.querySelector('.close').addEventListener('click', () => {
  editModal.style.display = 'none';
});

document.getElementById('cancelEdit').addEventListener('click', () => {
  editModal.style.display = 'none';
});

window.onclick = (e) => {
  if (e.target === editModal) {
    editModal.style.display = 'none';
  }
};

// Filtros
filterTemporada.addEventListener('change', () => {
  loadProducts(filterTemporada.value);
});

refreshBtn.addEventListener('click', () => {
  filterTemporada.value = '';
  loadProducts();
});

// Función auxiliar para mensajes
function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
  element.style.color = type === 'success' ? '#155724' : '#721c24';
  element.style.padding = '0.75rem';
  element.style.borderRadius = '8px';
  element.style.marginTop = '1rem';
  
  setTimeout(() => {
    if (type !== 'success') {
      element.textContent = '';
      element.style.padding = '0';
    }
  }, 5000);
}

// Actualizar badge del carrito
async function updateCartBadge() {
  try {
    const res = await fetch('/api/carrito');
    const carrito = await res.json();
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = carrito.length;
      badge.style.display = carrito.length > 0 ? 'inline-block' : 'none';
    }
  } catch (error) {
    console.error('Error actualizando badge:', error);
  }
}

// Inicializar
checkAuth();
updateCartBadge();