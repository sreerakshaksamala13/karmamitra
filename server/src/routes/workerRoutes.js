const express = require('express');
const {
  listWorkers,
  getWorker,
  createWorker,
  updateWorker,
  setWorkerStatus,
  deleteWorker,
} = require('../controllers/workerController');

const router = express.Router();

router.route('/').get(listWorkers).post(createWorker);
router.route('/:id').get(getWorker).put(updateWorker).delete(deleteWorker);
router.patch('/:id/status', setWorkerStatus);

module.exports = router;