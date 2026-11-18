import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { connectDB, disconnectDB } from '../lib/db';
import { connectRedis, disconnectRedis, redis } from '../lib/redis';
import { User, UserRole } from '../models/user.model';
import { Camera } from '../models/camera.model';
import { Blacklist } from '../models/blacklist.model';

interface DemoUserDef {
  email: string;
  name: string;
  role: UserRole;
  passwordEnv: string;
}

const DEMO_USERS: DemoUserDef[] = [
  {
    email: 'admin@pravaah.local',
    name: 'System Administrator',
    role: 'Admin',
    passwordEnv: env.SEED_ADMIN_PASSWORD,
  },
  {
    email: 'traffic@pravaah.local',
    name: 'Delhi Traffic Control Officer',
    role: 'TrafficAuthority',
    passwordEnv: env.SEED_TRAFFIC_PASSWORD,
  },
  {
    email: 'police@pravaah.local',
    name: 'Inspector Sharma (Special Cell)',
    role: 'Police',
    passwordEnv: env.SEED_POLICE_PASSWORD,
  },
  {
    email: 'analyst@pravaah.local',
    name: 'Urban Mobility Analyst',
    role: 'Analyst',
    passwordEnv: env.SEED_ANALYST_PASSWORD,
  },
];

async function seedUsers() {
  console.log('👤 Seeding demo users...');
  let seededCount = 0;

  for (const def of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(def.passwordEnv, 10);

    await User.findOneAndUpdate(
      { email: def.email.toLowerCase() },
      {
        user_id: uuidv4(),
        email: def.email.toLowerCase(),
        password_hash: passwordHash,
        role: def.role,
        name: def.name,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`  ✓ Demo user ready: ${def.email} [Role: ${def.role}]`);
    seededCount++;
  }

  console.log(`✅ Seeded ${seededCount} demo users.`);
}

async function seedCameras() {
  console.log('📷 Seeding cameras from data/cameras.json...');
  const camerasPath = path.resolve(__dirname, '../../../data/cameras.json');

  if (!fs.existsSync(camerasPath)) {
    console.warn(`⚠️ Cameras file not found at ${camerasPath}`);
    return;
  }

  const raw = fs.readFileSync(camerasPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const cameraList = Array.isArray(parsed) ? parsed : parsed.cameras || [];

  let count = 0;
  for (const cam of cameraList) {
    await Camera.findOneAndUpdate(
      { id: cam.id },
      {
        id: cam.id,
        name: cam.name,
        location: cam.location,
        address: cam.address || '',
        zone: cam.zone || 'general',
        rtsp_url: cam.rtsp_url || '',
        active: cam.active ?? true,
        installed_at: cam.installed_at || new Date().toISOString(),
        edges: cam.edges || [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count++;
  }

  console.log(`✅ Seeded ${count} cameras into MongoDB.`);
}

async function seedBlacklist() {
  console.log('🚨 Seeding blacklist from data/blacklist_seed.json and syncing Redis set...');
  const blacklistPath = path.resolve(__dirname, '../../../data/blacklist_seed.json');

  if (!fs.existsSync(blacklistPath)) {
    console.warn(`⚠️ Blacklist file not found at ${blacklistPath}`);
    return;
  }

  const raw = fs.readFileSync(blacklistPath, 'utf-8');
  const blacklistEntries: Array<{
    plate_text: string;
    reason: string;
    added_by: string;
    added_at?: string;
    severity?: string;
    agency?: string;
  }> = JSON.parse(raw);

  let count = 0;
  const plateList: string[] = [];

  for (const entry of blacklistEntries) {
    const plate = entry.plate_text.trim().toUpperCase();
    await Blacklist.findOneAndUpdate(
      { plate_text: plate },
      {
        plate_text: plate,
        reason: entry.reason,
        added_by: entry.added_by,
        added_at: entry.added_at || new Date().toISOString(),
        severity: entry.severity || 'HIGH',
        agency: entry.agency || 'Delhi Police',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    plateList.push(plate);
    count++;
  }

  if (plateList.length > 0) {
    await redis.sadd('blacklist:plates', ...plateList);
  }

  console.log(`✅ Seeded ${count} blacklist entries to MongoDB and Redis 'blacklist:plates'.`);
}

async function main() {
  try {
    await connectDB();
    await connectRedis();

    await seedUsers();
    await seedCameras();
    await seedBlacklist();

    console.log('🎉 Database seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    await disconnectRedis();
    process.exit(0);
  }
}

main();
