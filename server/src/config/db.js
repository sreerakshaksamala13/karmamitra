const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Reused by the server bootstrap and the seed script.
 */
async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

module.exports = { connectDB };