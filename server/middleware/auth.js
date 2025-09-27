const jwt = require('jsonwebtoken');
const config = require('../config.json');

function extractToken(req) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
  }
  return token;
}

module.exports = {
  isAdmin: (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
      const decoded = jwt.verify(token, config.secret);
      if (decoded.role !== 'Admin' && decoded.role !== 'Super-Admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },
  isSuperAdmin: (req, res, next) => {
    const token = extractToken(req);
    console.log('[isSuperAdmin] Token:', token);
    if (!token) {
      console.log('[isSuperAdmin] No token found');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
      const decoded = jwt.verify(token, config.secret);
      console.log('[isSuperAdmin] Decoded token:', decoded);
      if (decoded.role !== 'Super-Admin') {
        console.log('[isSuperAdmin] Forbidden: role is', decoded.role);
        return res.status(403).json({ message: 'Forbidden: Super-Admin only' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      console.log('[isSuperAdmin] Invalid token:', error);
      return res.status(401).json({ message: 'Invalid token' });
    }
  }
}; 