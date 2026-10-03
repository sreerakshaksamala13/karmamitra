const express = require('express');
const {
  getDues,
  createPayment,
  listPayments,
  getPayment,
  updatePayment,
  deletePayment,
} = require('../controllers/paymentController');

const router = express.Router();

// /dues must be declared before /:id style routes.
router.get('/dues', getDues);

router.route('/').get(listPayments).post(createPayment);
router.route('/:id').get(getPayment).put(updatePayment).delete(deletePayment);

module.exports = router;