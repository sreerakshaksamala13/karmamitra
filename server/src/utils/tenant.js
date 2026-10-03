const Worker = require('../models/Worker');

function getOwnedWorkerIds(userId) {
  return Worker.distinct('_id', { createdBy: userId });
}

module.exports = { getOwnedWorkerIds };
