const express = require('express');
const router = express.Router();
const pool = require('../db');

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { username, password, nombre_completo, email } = req.body;

    // Validaciones básicas
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar si el usuario ya existe
    const [existing] = await pool.query(
      'SELECT id_cliente FROM Cliente WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Insertar nuevo cliente
    const [result] = await pool.query(
      'INSERT INTO Cliente (username, password, nombre_completo, email, rol) VALUES (?, ?, ?, ?, ?)',
      [username, password, nombre_completo || null, email || null, 'cliente']
    );

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      id_cliente: result.insertId
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Buscar usuario
    const [users] = await pool.query(
      'SELECT id_cliente, username, nombre_completo, email, rol FROM Cliente WHERE username = ? AND password = ?',
      [username, password]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Crear sesión
    req.session.userId = user.id_cliente;
    req.session.username = user.username;
    req.session.userRole = user.rol;

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      user: {
        id: user.id_cliente,
        username: user.username,
        nombre_completo: user.nombre_completo,
        email: user.email,
        rol: user.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.json({ mensaje: 'Sesión cerrada exitosamente' });
  });
});

// Verificar sesión
router.get('/check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      username: req.session.username,
      role: req.session.userRole
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Obtener perfil del usuario
router.get('/profile', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const [users] = await pool.query(
      'SELECT id_cliente, username, nombre_completo, email, rol FROM Cliente WHERE id_cliente = ?',
      [req.session.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(users[0]);

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

module.exports = router;