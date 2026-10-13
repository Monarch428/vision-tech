const jwt = require('jsonwebtoken');

const STAFF_ROLES = ['admin', 'support'];

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Not authorized, token missing',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tokens carry `id`; many controllers read `_id`, so expose both.
    req.user = { ...decoded, _id: decoded.id };
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Not authorized, invalid token',
    });
  }
};

// Use after protect(): allows the request only when the token's role is listed.
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Forbidden: insufficient permissions',
    });
  }
  next();
};

const isStaff = (req) => STAFF_ROLES.includes(req.user?.role);

module.exports = {
  protect,
  authorize,
  isStaff,
  STAFF_ROLES,
};
