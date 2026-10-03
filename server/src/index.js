require('dotenv').config();

const { createApp } = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5005;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/karmamitra';

async function start() {
  if (!process.env.JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('[warn] JWT_SECRET is not set - using an insecure development default.');
    process.env.JWT_SECRET = 'insecure-dev-secret-change-me';
  }

  await connectDB(MONGO_URI);
  const app = createApp();

  // Bind on 0.0.0.0 so a phone on the same Wi-Fi can reach the API.
  app.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Karmamitra API listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err.message);
  process.exit(1);
});