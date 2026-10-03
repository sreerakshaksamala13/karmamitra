const express = require('express');
const {
  listSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
} = require('../controllers/siteController');

const router = express.Router();

router.route('/').get(listSites).post(createSite);
router.route('/:id').get(getSite).put(updateSite).delete(deleteSite);

module.exports = router;