const express = require('express');
const { register, login, me, deleteAccount } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.delete('/account', requireAuth, deleteAccount);

module.exports = router;