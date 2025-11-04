const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas del carrito requieren autenticación
router.use(requireAuth);

// Obtener carrito del usuario
router.get('/', async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT 
        c.id_carrito,
        c.id_producto,
        c.cantidad,
        p.nombre,
        p.precio,
        p.descripcion,
        p.temporada,
        p.imagen_url,
        COALESCE(i.cantidad_actual, 0) as stock_disponible,
        (c.cantidad * p.precio) as subtotal
      FROM CarritoCompras c
      INNER JOIN Producto p ON c.id_producto = p.id_producto
      LEFT JOIN Inventario i ON p.id_producto = i.id_producto
      WHERE c.id_cliente = ? AND c.activo = 1 AND p.activo = 1
      ORDER BY c.id_carrito DESC`,
      [req.session.userId]
    );

    res.json(items);

  } catch (error) {
    console.error('Error obteniendo carrito:', error);
    res.status(500).json({ error: 'Error al obtener carrito' });
  }
});

// Agregar producto al carrito
router.post('/agregar', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id_producto, cantidad } = req.body;
    const id_cliente = req.session.userId;

    if (!id_producto || !cantidad || cantidad <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Producto y cantidad son requeridos' });
    }

    // Verificar que el producto existe y está activo
    const [producto] = await connection.query(
      `SELECT p.id_producto, p.nombre, p.precio, p.activo,
              COALESCE(i.cantidad_actual, 0) as stock
       FROM Producto p
       LEFT JOIN Inventario i ON p.id_producto = i.id_producto
       WHERE p.id_producto = ?`,
      [id_producto]
    );

    if (producto.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    if (!producto[0].activo) {
      await connection.rollback();
      return res.status(400).json({ error: 'Producto no disponible' });
    }

    if (producto[0].stock < cantidad) {
      await connection.rollback();
      return res.status(400).json({ 
        error: `Stock insuficiente. Solo hay ${producto[0].stock} unidades disponibles` 
      });
    }

    // Verificar si el producto ya está en el carrito
    const [existing] = await connection.query(
      'SELECT id_carrito, cantidad FROM CarritoCompras WHERE id_cliente = ? AND id_producto = ? AND activo = 1',
      [id_cliente, id_producto]
    );

    if (existing.length > 0) {
      // Actualizar cantidad
      const newQuantity = existing[0].cantidad + cantidad;
      
      if (newQuantity > producto[0].stock) {
        await connection.rollback();
        return res.status(400).json({ 
          error: `Stock insuficiente. Solo hay ${producto[0].stock} unidades disponibles` 
        });
      }

      await connection.query(
        'UPDATE CarritoCompras SET cantidad = ? WHERE id_carrito = ?',
        [newQuantity, existing[0].id_carrito]
      );
    } else {
      // Insertar nuevo item
      await connection.query(
        'INSERT INTO CarritoCompras (id_cliente, id_producto, cantidad, activo) VALUES (?, ?, ?, 1)',
        [id_cliente, id_producto, cantidad]
      );
    }

    await connection.commit();

    res.json({ 
      mensaje: 'Producto agregado al carrito',
      producto: producto[0].nombre
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error agregando al carrito:', error);
    res.status(500).json({ error: 'Error al agregar producto al carrito' });
  } finally {
    connection.release();
  }
});

// Actualizar cantidad de un item
router.put('/:id', async (req, res) => {
  try {
    const { cantidad } = req.body;
    const id_carrito = req.params.id;
    const id_cliente = req.session.userId;

    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // Verificar que el item pertenece al usuario
    const [item] = await pool.query(
      `SELECT c.id_carrito, c.id_producto, c.cantidad,
              COALESCE(i.cantidad_actual, 0) as stock
       FROM CarritoCompras c
       INNER JOIN Producto p ON c.id_producto = p.id_producto
       LEFT JOIN Inventario i ON p.id_producto = i.id_producto
       WHERE c.id_carrito = ? AND c.id_cliente = ? AND c.activo = 1`,
      [id_carrito, id_cliente]
    );

    if (item.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    if (cantidad > item[0].stock) {
      return res.status(400).json({ 
        error: `Stock insuficiente. Solo hay ${item[0].stock} unidades disponibles` 
      });
    }

    await pool.query(
      'UPDATE CarritoCompras SET cantidad = ? WHERE id_carrito = ?',
      [cantidad, id_carrito]
    );

    res.json({ mensaje: 'Cantidad actualizada' });

  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    res.status(500).json({ error: 'Error al actualizar cantidad' });
  }
});

// Eliminar item del carrito
router.delete('/:id', async (req, res) => {
  try {
    const id_carrito = req.params.id;
    const id_cliente = req.session.userId;

    const [result] = await pool.query(
      'UPDATE CarritoCompras SET activo = 0 WHERE id_carrito = ? AND id_cliente = ?',
      [id_carrito, id_cliente]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    res.json({ mensaje: 'Item eliminado del carrito' });

  } catch (error) {
    console.error('Error eliminando item:', error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// Vaciar carrito completo
router.delete('/vaciar/todo', async (req, res) => {
  try {
    const id_cliente = req.session.userId;

    await pool.query(
      'UPDATE CarritoCompras SET activo = 0 WHERE id_cliente = ?',
      [id_cliente]
    );

    res.json({ mensaje: 'Carrito vaciado' });

  } catch (error) {
    console.error('Error vaciando carrito:', error);
    res.status(500).json({ error: 'Error al vaciar carrito' });
  }
});

module.exports = router;