import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next(new ApiError(401, 'Not authorized. Please log in.'));
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const admin = await Admin.findById(decoded.sub).select('-passwordHash');
    if (!admin) {
      return next(new ApiError(401, 'Account no longer exists.'));
    }
    req.admin = admin;
    req.token = token;
    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired token.'));
  }
}

export default protect;