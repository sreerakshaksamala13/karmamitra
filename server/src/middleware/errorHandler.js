/* eslint-disable no-unused-vars */
/**
 * Central error handler. Turns validation and duplicate-key errors into
 * friendly 400 responses instead of 500s.
 */
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = field ? `${field} already exists` : 'Duplicate value';
  }

  if (process.env.NODE_ENV !== 'test' && status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({ message });
}

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };