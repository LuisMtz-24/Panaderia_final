const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Obtener todas las categorías
router.get('/categorias/list', async (req, res) => {
  try {
    const [categorias] = await pool.query(
      'SELECT id_categoria, nombre, descripcion FROM Categoria ORDER BY nombre'
    );
    res.json(categorias);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// Obtener productos con filtros
router.get('/', async (req, res) => {
  try {
    const { temporada, categoria, activo } = req.query;
    
    let query = `
      SELECT 
        p.id_producto,
        p.nombre,
        p.descripcion,
        p.precio,
        p.temporada,
        p.imagen_url,
        p.activo,
        p.id_categoria,
        c.nombre as categoria_nombre,
        COALESCE(i.cantidad_actual, 0) as stock
      FROM Producto p
      LEFT JOIN Categoria c ON p.id_categoria = c.id_categoria
      LEFT JOIN Inventario i ON p.id_producto = i.id_producto
      WHERE 1=1
    `;
    
    const params = [];

    if (temporada) {
      if (Array.isArray(temporada)) {
        query += ` AND p.temporada IN (${temporada.map(() => '?').join(',')})`;
        params.push(...temporada);
      } else {
        query += ' AND p.temporada = ?';
        params.push(temporada);
      }
    }

    if (categoria) {
      query += ' AND p.id_categoria = ?';
      params.push(categoria);
    }

    if (activo !== undefined) {
      query += ' AND p.activo = ?';
      params.push(activo === 'true' || activo === '1' ? 1 : 0);
    }

    query += ' ORDER BY p.nombre';

    const [productos] = await pool.query(query, params);
    res.json(productos);

  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener un producto por ID
router.get('/:id', async (req, res) => {
  try {
    const [productos] = await pool.query(
      `SELECT 
        p.id_producto,
        p.nombre,
        p.descripcion,
        p.precio,
        p.temporada,
        p.imagen_url,
        p.activo,
        p.id_categoria,
        c.nombre as categoria_nombre,
        COALESCE(i.cantidad_actual, 0) as stock
      FROM Producto p
      LEFT JOIN Categoria c ON p.id_categoria = c.id_categoria
      LEFT JOIN Inventario i ON p.id_producto = i.id_producto
      WHERE p.id_producto = ?`,
      [req.params.id]
    );

    if (productos.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(productos[0]);

  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// Crear producto (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { nombre, descripcion, precio, stock, id_categoria, temporada, imagen_url } = req.body;

    if (!nombre || !precio || stock === undefined) {
      await connection.rollback();
      return res.status(400).json({ error: 'Nombre, precio y stock son requeridos' });
    }

    // Insertar producto
    const [result] = await connection.query(
      `INSERT INTO Producto (nombre, descripcion, precio, id_categoria, temporada, imagen_url, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nombre, descripcion || null, precio, id_categoria || null, temporada || 'regular', imagen_url || null]
    );

    const productId = result.insertId;

    // Crear registro de inventario
    await connection.query(
      'INSERT INTO Inventario (id_producto, cantidad_actual, cantidad_reservada) VALUES (?, ?, 0)',
      [productId, stock || 0]
    );

    // Registrar movimiento de entrada
    if (stock > 0) {
      await connection.query(
        'INSERT INTO MovimientoEntrada (id_producto, cantidad, fecha) VALUES (?, ?, NOW())',
        [productId, stock]
      );
    }

    await connection.commit();

    res.status(201).json({
      mensaje: 'Producto creado exitosamente',
      id_producto: productId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  } finally {
    connection.release();
  }
});

// Actualizar producto (solo admin)
router.put('/:id', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { nombre, descripcion, precio, stock, id_categoria, temporada, imagen_url, activo } = req.body;
    const productId = req.params.id;

    // Verificar que el producto existe
    const [existing] = await connection.query('SELECT id_producto FROM Producto WHERE id_producto = ?', [productId]);
    
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Actualizar producto
    await connection.query(
      `UPDATE Producto 
       SET nombre = ?, descripcion = ?, precio = ?, id_categoria = ?, 
           temporada = ?, imagen_url = ?, activo = ?
       WHERE id_producto = ?`,
      [nombre, descripcion || null, precio, id_categoria || null, 
       temporada || 'regular', imagen_url || null, activo ? 1 : 0, productId]
    );

    // Actualizar stock si cambió
    if (stock !== undefined) {
      const [currentInventory] = await connection.query(
        'SELECT cantidad_actual FROM Inventario WHERE id_producto = ?',
        [productId]
      );

      if (currentInventory.length > 0) {
        const currentStock = currentInventory[0].cantidad_actual;
        const difference = stock - currentStock;

        // Actualizar inventario
        await connection.query(
          'UPDATE Inventario SET cantidad_actual = ? WHERE id_producto = ?',
          [stock, productId]
        );

        // Registrar movimiento
        if (difference !== 0) {
          if (difference > 0) {
            await connection.query(
              'INSERT INTO MovimientoEntrada (id_producto, cantidad, fecha) VALUES (?, ?, NOW())',
              [productId, difference]
            );
          } else {
            await connection.query(
              'INSERT INTO MovimientoSalida (id_producto, cantidad, fecha) VALUES (?, ?, NOW())',
              [productId, Math.abs(difference)]
            );
          }
        }
      } else {
        // Crear inventario si no existe
        await connection.query(
          'INSERT INTO Inventario (id_producto, cantidad_actual, cantidad_reservada) VALUES (?, ?, 0)',
          [productId, stock]
        );
      }
    }

    await connection.commit();

    res.json({ mensaje: 'Producto actualizado exitosamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  } finally {
    connection.release();
  }
});

// Eliminar producto (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE Producto SET activo = 0 WHERE id_producto = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto desactivado exitosamente' });

  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;