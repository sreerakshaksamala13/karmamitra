const express = require('express');

const authRoutes = require('./authRoutes');
const workerRoutes = require('./workerRoutes');
const siteRoutes = require('./siteRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const paymentRoutes = require('./paymentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/workers', requireAuth, workerRoutes);
router.use('/sites', requireAuth, siteRoutes);
router.use('/attendance', requireAuth, attendanceRoutes);
router.use('/payments', requireAuth, paymentRoutes);

module.exports = router;