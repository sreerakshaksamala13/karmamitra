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

/**
 * DELETE /api/auth/account
 * Deletes the account AND every record it owns (sites, workers, attendance,
 * payments, dispatches). Cannot be undone.
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const Worker = require('../models/Worker');
  const Site = require('../models/Site');
  const Attendance = require('../models/Attendance');
  const Payment = require('../models/Payment');
  const WorkAssignment = require('../models/WorkAssignment');

  const workerIds = await Worker.find({ createdBy: userId }).distinct('_id');

  await Promise.all([
    Attendance.deleteMany({ worker: { $in: workerIds } }),
    Payment.deleteMany({ createdBy: userId }),
    WorkAssignment.deleteMany({ createdBy: userId }),
    Worker.deleteMany({ createdBy: userId }),
    Site.deleteMany({ createdBy: userId }),
  ]);

  await User.deleteOne({ _id: userId });
  return res.json({ message: 'Account and all its sites, workers and records deleted.' });
});

module.exports = { register, login, me, deleteAccount };