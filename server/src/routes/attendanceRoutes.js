const express = require('express');
const {
  listAttendance,
  getDailySheet,
  markAttendance,
  bulkMarkAttendance,
  deleteAttendance,
  attendanceSummary,
} = require('../controllers/attendanceController');

const router = express.Router();

// Static paths must be declared before /:id style routes.
router.get('/sheet', getDailySheet);
router.get('/summary', attendanceSummary);
router.post('/bulk', bulkMarkAttendance);

router.route('/').get(listAttendance).post(markAttendance);
router.delete('/:id', deleteAttendance);

module.exports = router;