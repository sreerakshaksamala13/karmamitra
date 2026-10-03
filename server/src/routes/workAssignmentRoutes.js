const express = require('express');
const {
  getWorkAssignments,
  createWorkAssignment,
  updateWorkAssignment,
  deleteWorkAssignment,
  updateCollectionStatus,
} = require('../controllers/workAssignmentController');

const router = express.Router();

router.route('/').get(getWorkAssignments).post(createWorkAssignment);
router.route('/:id').put(updateWorkAssignment).delete(deleteWorkAssignment);
router.patch('/:id/collection', updateCollectionStatus);

module.exports = router;
