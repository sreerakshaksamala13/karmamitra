require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Site = require('./models/Site');
const Worker = require('./models/Worker');
const Attendance = require('./models/Attendance');
const Payment = require('./models/Payment');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/karmamitra';

const OWNER_PHONE = process.env.SEED_OWNER_PHONE || '9999999999';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'admin123';

function iso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

const SITES = [
  { name: 'Sunrise Apartments', location: 'Kondapur', clientName: 'Ramesh Builders', dailyRateToClient: 900 },
  { name: 'Green Villa', location: 'Gachibowli', clientName: 'Mr. Anand', dailyRateToClient: 850 },
];

const WORKERS = [
  { name: 'Ravi Kumar', role: 'Mason', dailyWage: 800, siteIndex: 0, phone: '9000000001' },
  { name: 'Suresh Yadav', role: 'Helper', dailyWage: 500, siteIndex: 0, phone: '9000000002' },
  { name: 'Mahesh Reddy', role: 'Carpenter', dailyWage: 750, siteIndex: 0, phone: '9000000003' },
  { name: 'Anil Sharma', role: 'Helper', dailyWage: 500, siteIndex: 0, phone: '9000000004' },
  { name: 'Vijay Singh', role: 'Mason', dailyWage: 800, siteIndex: 1, phone: '9000000005' },
  { name: 'Kiran Das', role: 'Painter', dailyWage: 700, siteIndex: 1, phone: '9000000006' },
  { name: 'Raju Naidu', role: 'Plumber', dailyWage: 850, siteIndex: 1, phone: '9000000007' },
  { name: 'Ganesh Patil', role: 'Helper', dailyWage: 500, siteIndex: 1, phone: '9000000008' },
];

async function run() {
  await connectDB(MONGO_URI);

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Site.deleteMany({}),
    Worker.deleteMany({}),
    Attendance.deleteMany({}),
    Payment.deleteMany({}),
  ]);

  const owner = await User.create({
    name: 'Owner',
    phone: OWNER_PHONE,
    password: OWNER_PASSWORD,
    role: 'owner',
  });
  console.log(`Owner created: phone=${OWNER_PHONE} password=${OWNER_PASSWORD}`);

  const sites = await Site.insertMany(
    SITES.map((s) => ({ ...s, createdBy: owner._id, startDate: new Date(daysAgo(60)) }))
  );

  const workers = await Worker.insertMany(
    WORKERS.map((w) => ({
      name: w.name,
      role: w.role,
      phone: w.phone,
      dailyWage: w.dailyWage,
      site: sites[w.siteIndex]._id,
      joinDate: new Date(daysAgo(45)),
      active: true,
      createdBy: owner._id,
    }))
  );
  console.log(`Created ${sites.length} sites and ${workers.length} workers`);

  // Mark the last 14 days. Sundays are off (absent) for everyone.
  const attendanceDocs = [];
  for (let d = 13; d >= 0; d -= 1) {
    const date = daysAgo(d);
    const isSunday = new Date(`${date}T00:00:00`).getDay() === 0;
    workers.forEach((worker, idx) => {
      let status = 'present';
      if (isSunday) status = 'absent';
      else if ((idx + d) % 7 === 0) status = 'absent';
      else if ((idx + d) % 11 === 0) status = 'half-day';

      const factor = { present: 1, 'half-day': 0.5, absent: 0 }[status];
      attendanceDocs.push({
        worker: worker._id,
        site: worker.site,
        date,
        status,
        wageRate: worker.dailyWage,
        wageAmount: Math.round(worker.dailyWage * factor * 100) / 100,
        markedBy: owner._id,
      });
    });
  }
  const inserted = await Attendance.insertMany(attendanceDocs);
  console.log(`Created ${inserted.length} attendance rows`);

  // Pay one worker for days up to last Wednesday, leaving the rest outstanding.
  const target = workers[0];
  const cutOff = daysAgo(7);
  const toPay = await Attendance.find({
    worker: target._id,
    paidInPayment: null,
    date: { $lte: cutOff },
  });
  if (toPay.length) {
    const gross = Math.round(toPay.reduce((s, a) => s + a.wageAmount, 0) * 100) / 100;
    const payment = new Payment({
      worker: target._id,
      attendance: toPay.map((a) => a._id),
      fromDate: toPay.reduce((min, a) => (a.date < min ? a.date : min), cutOff),
      toDate: cutOff,
      grossAmount: gross,
      deduction: 100,
      bonus: 0,
      method: 'cash',
      status: 'paid',
      notes: 'Weekly Wednesday payout (seeded)',
      paidAt: new Date(`${cutOff}T18:00:00.000`),
      createdBy: owner._id,
    });
    payment.recomputeNet();
    await payment.save();
    await Attendance.updateMany(
      { _id: { $in: payment.attendance } },
      { $set: { paidInPayment: payment._id } }
    );
    console.log(`Seeded a payment of ${payment.netAmount} for ${target.name}`);
  }

  console.log('\nSeed complete.');
  console.log(`Login with phone ${OWNER_PHONE} / password ${OWNER_PASSWORD}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});