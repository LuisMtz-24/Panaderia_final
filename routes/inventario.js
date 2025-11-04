const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación de admin
router.use(requireAdmin);

// Obtener inventario completo
router.get('/', async (req, res) => {
  try {
    const [inventario] = await pool.query(
      `SELECT 
        i.id_inventario,
        i.id_producto,
        i.cantidad_actual,
        i.cantidad_reservada,
        i.ultima_actualizacion,
        p.nombre as producto_nombre,
        p.precio,
        c.nombre as categoria_nombre
      FROM Inventario i
      INNER JOIN Producto p ON i.id_producto = p.id_producto
      LEFT JOIN Categoria c ON p.id_categoria = c.id_categoria
      ORDER BY i.cantidad_actual ASC`
    );

    res.json(inventario);

  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// Obtener inventario de un producto específico
router.get('/:idProducto', async (req, res) => {
  try {
    const [inventario] = await pool.query(
      `SELECT 
        i.id_inventario,
        i.id_producto,
        i.cantidad_actual,
        i.cantidad_reservada,
        i.ultima_actualizacion,
        p.nombre as producto_nombre,
        p.precio
      FROM Inventario i
      INNER JOIN Producto p ON i.id_producto = p.id_producto
      WHERE i.id_producto = ?`,
      [req.params.idProducto]
    );

    if (inventario.length === 0) {
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }

    res.json(inventario[0]);

  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// Registrar entrada de inventario
router.post('/entrada', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id_producto, cantidad } = req.body;

    if (!id_producto || !cantidad || cantidad <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Producto y cantidad válida son requeridos' });
    }

    // Verificar que el producto existe
    const [producto] = await connection.query(
      'SELECT id_producto FROM Producto WHERE id_producto = ?',
      [id_producto]
    );

    if (producto.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Registrar movimiento de entrada
    await connection.query(
      'INSERT INTO MovimientoEntrada (id_producto, cantidad, fecha) VALUES (?, ?, NOW())',
      [id_producto, cantidad]
    );

    // Actualizar inventario
    await connection.query(
      `INSERT INTO Inventario (id_producto, cantidad_actual, cantidad_reservada) 
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE 
       cantidad_actual = cantidad_actual + ?,
       ultima_actualizacion = NOW()`,
      [id_producto, cantidad, cantidad]
    );

    await connection.commit();

    res.json({ 
      mensaje: 'Entrada registrada exitosamente',
      cantidad: cantidad
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error registrando entrada:', error);
    res.status(500).json({ error: 'Error al registrar entrada' });
  } finally {
    connection.release();
  }
});

// Registrar salida de inventario
router.post('/salida', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id_producto, cantidad, referencia } = req.body;

    if (!id_producto || !cantidad || cantidad <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Producto y cantidad válida son requeridos' });
    }

    // Verificar inventario disponible
    const [inventario] = await connection.query(
      'SELECT cantidad_actual FROM Inventario WHERE id_producto = ?',
      [id_producto]
    );

    if (inventario.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }

    if (inventario[0].cantidad_actual < cantidad) {
      await connection.rollback();
      return res.status(400).json({ 
        error: `Stock insuficiente. Solo hay ${inventario[0].cantidad_actual} unidades disponibles` 
      });
    }

    // Registrar movimiento de salida
    await connection.query(
      'INSERT INTO MovimientoSalida (id_producto, cantidad, fecha, referencia) VALUES (?, ?, NOW(), ?)',
      [id_producto, cantidad, referencia || null]
    );

    // Actualizar inventario
    await connection.query(
      `UPDATE Inventario 
       SET cantidad_actual = cantidad_actual - ?,
           ultima_actualizacion = NOW()
       WHERE id_producto = ?`,
      [cantidad, id_producto]
    );

    await connection.commit();

    res.json({ 
      mensaje: 'Salida registrada exitosamente',
      cantidad: cantidad
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error registrando salida:', error);
    res.status(500).json({ error: 'Error al registrar salida' });
  } finally {
    connection.release();
  }
});

// Obtener movimientos de un producto
router.get('/movimientos/:idProducto', async (req, res) => {
  try {
    const [entradas] = await pool.query(
      'SELECT id_entrada as id, "entrada" as tipo, cantidad, fecha FROM MovimientoEntrada WHERE id_producto = ?',
      [req.params.idProducto]
    );

    const [salidas] = await pool.query(
      'SELECT id_salida as id, "salida" as tipo, cantidad, fecha, referencia FROM MovimientoSalida WHERE id_producto = ?',
      [req.params.idProducto]
    );

    const movimientos = [...entradas, ...salidas].sort((a, b) => 
      new Date(b.fecha) - new Date(a.fecha)
    );

    res.json(movimientos);

  } catch (error) {
    console.error('Error obteniendo movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// Ajustar inventario manualmente
router.put('/ajustar/:idProducto', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { cantidad_actual } = req.body;
    const id_producto = req.params.idProducto;

    if (cantidad_actual === undefined || cantidad_actual < 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // Obtener cantidad actual
    const [inventario] = await connection.query(
      'SELECT cantidad_actual FROM Inventario WHERE id_producto = ?',
      [id_producto]
    );

    if (inventario.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }

    const difference = cantidad_actual - inventario[0].cantidad_actual;

    // Actualizar inventario
    await connection.query(
      'UPDATE Inventario SET cantidad_actual = ?, ultima_actualizacion = NOW() WHERE id_producto = ?',
      [cantidad_actual, id_producto]
    );

    // Registrar movimiento correspondiente
    if (difference !== 0) {
      if (difference > 0) {
        await connection.query(
          'INSERT INTO MovimientoEntrada (id_producto, cantidad, fecha) VALUES (?, ?, NOW())',
          [id_producto, difference]
        );
      } else {
        await connection.query(
          'INSERT INTO MovimientoSalida (id_producto, cantidad, fecha, referencia) VALUES (?, ?, NOW(), "AJUSTE MANUAL")',
          [id_producto, Math.abs(difference)]
        );
      }
    }

    await connection.commit();

    res.json({ 
      mensaje: 'Inventario ajustado exitosamente',
      cantidad_actual: cantidad_actual
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error ajustando inventario:', error);
    res.status(500).json({ error: 'Error al ajustar inventario' });
  } finally {
    connection.release();
  }
});

module.exports = router;