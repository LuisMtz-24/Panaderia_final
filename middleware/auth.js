// Middleware para verificar que el usuario está autenticado
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'No autenticado',
      mensaje: 'Debes iniciar sesión para acceder a este recurso' 
    });
  }
  next();
};

// Middleware para verificar que el usuario es administrador
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'No autenticado',
      mensaje: 'Debes iniciar sesión para acceder a este recurso' 
    });
  }

  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      mensaje: 'Se requiere rol de administrador para acceder a este recurso' 
    });
  }

  next();
};

// Middleware para verificar que el usuario es cliente
const requireClient = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'No autenticado',
      mensaje: 'Debes iniciar sesión para acceder a este recurso' 
    });
  }

  if (req.session.userRole !== 'cliente' && req.session.userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      mensaje: 'Este recurso es solo para clientes' 
    });
  }

  next();
};

// Middleware opcional - no requiere autenticación pero añade info si está disponible
const optionalAuth = (req, res, next) => {
  // Si hay sesión, la info estará disponible en req.session
  // Si no hay sesión, simplemente continúa
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireClient,
  optionalAuth
};