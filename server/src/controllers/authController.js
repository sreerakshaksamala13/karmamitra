const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

/**
 * POST /api/auth/register
 * Create an account. Each account owns an isolated set of business records.
 */
const register = asyncHandler(async (req, res) => {
  const { name, phone, password } = req.body;

  const exists = await User.findOne({ phone });
  if (exists) {
    return res.status(400).json({ message: 'Phone number already registered' });
  }

  const user = await User.create({ name, phone, password });
  return res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  const user = await User.findOne({ phone }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid phone number or password' });
  }

  return res.json({ token: signToken(user), user: user.toSafeJSON() });
});

/**
 * GET /api/auth/me
 */
const me = asyncHandler(async (req, res) => {
  return res.json({ user: req.user.toSafeJSON() });
});

module.exports = { register, login, me };