const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user || req.user.status === 'inactive') {
        return res.status(401).json({ message: 'User unauthorized or inactive' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Role '${req.user?.role}' is not allowed to access this route` 
      });
    }
    next();
  };
};

const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    const user = req.user;

    // Main Roles (Support Agent / End User / Admin) have full access to their operations
    if (user.role !== 'SubUser') {
      return next();
    }

    // SubUser check against granted permissions array
    if (user.permissions && user.permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({
      message: `Access Denied: Missing GRANT for '${permissionKey}'`
    });
  };
};



module.exports = { protect, authorizeRoles,requirePermission};