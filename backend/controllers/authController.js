import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

function signToken(admin) {
  return jwt.sign({ sub: admin._id.toString(), email: admin.email, role: admin.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }
  const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
  if (!admin || !(await bcrypt.compare(String(password), admin.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  res.json({
    token: signToken(admin),
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    admin: {
      id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role
    }
  });
});

export default { login, me };