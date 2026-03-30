const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  // Check for token in headers
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  // Check if it has Bearer format
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token format invalid' });
  }

  try {
    // Verify token
    // Using a default secret if JWT_SECRET isn't provided for robust local testing
    const secret = process.env.JWT_SECRET || 'super_secret_drive_key_123';
    const decoded = jwt.verify(token, secret);
    
    // Add user from payload to request object
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

module.exports = auth;
