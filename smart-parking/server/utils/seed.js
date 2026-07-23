require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Floor = require('../models/Floor');

const generateSlots = (rows, slotsPerRow) => {
  const slots = [];
  const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < rows; r++) {
    const rowLabel = rowLetters[r];
    for (let p = 1; p <= slotsPerRow; p++) {
      slots.push({
        slotNumber: `${rowLabel}${p}`,
        row: rowLabel,
        position: p,
        status: 'available',
      });
    }
  }
  return slots;
};

const seed = async () => {
  await connectDB();

  console.log('Clearing existing data...');
  await User.deleteMany({});
  await Floor.deleteMany({});

  console.log('Creating floors...');
  const floors = await Floor.insertMany([
    {
      name: 'Ground Floor',
      level: 0,
      displayOrder: 1,
      slots: generateSlots(5, 6), // 5 rows × 6 slots = 30 total
    },
    {
      name: '-1 Floor',
      level: -1,
      displayOrder: 2,
      slots: generateSlots(5, 7), // 35 total
    },
    {
      name: '-2 Floor',
      level: -2,
      displayOrder: 3,
      slots: generateSlots(4, 6), // 24 total
    },
  ]);

  console.log(`Created ${floors.length} floors.`);

  console.log('Creating admin user...');
  await User.create({
    name: 'Admin',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
  });

  console.log('Creating security staff...');
  await User.create([
    {
      name: 'Ravi Kumar',
      username: 'security_g',
      password: 'security123',
      role: 'security',
      assignedFloor: floors[0]._id,
    },
    {
      name: 'Suresh Babu',
      username: 'security_b1',
      password: 'security123',
      role: 'security',
      assignedFloor: floors[1]._id,
    },
    {
      name: 'Priya Reddy',
      username: 'security_b2',
      password: 'security123',
      role: 'security',
      assignedFloor: floors[2]._id,
    },
  ]);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n--- Login Credentials ---');
  console.log('Admin:    username: admin       | password: admin123');
  console.log('Security: username: security_g  | password: security123  (Ground Floor)');
  console.log('Security: username: security_b1 | password: security123  (-1 Floor)');
  console.log('Security: username: security_b2 | password: security123  (-2 Floor)');
  console.log('-------------------------\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
