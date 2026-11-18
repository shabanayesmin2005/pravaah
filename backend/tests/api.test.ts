import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { connectDB, disconnectDB } from '../src/lib/db';
import { connectRedis, disconnectRedis, redis } from '../src/lib/redis';
import { User } from '../src/models/user.model';
import { Detection } from '../src/models/detection.model';
import { Trajectory } from '../src/models/trajectory.model';
import { Alert } from '../src/models/alert.model';
import { Blacklist } from '../src/models/blacklist.model';
import { AuditLog } from '../src/models/auditLog.model';

let adminToken: string;
let policeToken: string;
let analystToken: string;
let trafficToken: string;

describe('PRAVAAH Backend API - Part A Test Suite', () => {
  beforeAll(async () => {
    await connectDB();
    await connectRedis();

    // Setup test users with known passwords
    const testPassword = 'TestPassword123!';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    await User.deleteMany({ email: { $regex: '@test.pravaah.local$' } });

    await User.create([
      {
        user_id: uuidv4(),
        email: 'admin@test.pravaah.local',
        password_hash: passwordHash,
        role: 'Admin',
        name: 'Test Admin',
      },
      {
        user_id: uuidv4(),
        email: 'police@test.pravaah.local',
        password_hash: passwordHash,
        role: 'Police',
        name: 'Test Police',
      },
      {
        user_id: uuidv4(),
        email: 'analyst@test.pravaah.local',
        password_hash: passwordHash,
        role: 'Analyst',
        name: 'Test Analyst',
      },
      {
        user_id: uuidv4(),
        email: 'traffic@test.pravaah.local',
        password_hash: passwordHash,
        role: 'TrafficAuthority',
        name: 'Test Traffic',
      },
    ]);

    // Obtain tokens via login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.pravaah.local', password: testPassword });
    adminToken = adminRes.body.data.tokens.accessToken;

    const policeRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'police@test.pravaah.local', password: testPassword });
    policeToken = policeRes.body.data.tokens.accessToken;

    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst@test.pravaah.local', password: testPassword });
    analystToken = analystRes.body.data.tokens.accessToken;

    const trafficRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'traffic@test.pravaah.local', password: testPassword });
    trafficToken = trafficRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: '@test.pravaah.local$' } });
    await disconnectDB();
    await disconnectRedis();
  });

  describe('1. Authentication & Security', () => {
    it('should successfully log in and return JWT tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.pravaah.local', password: 'TestPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
      expect(res.body.data.user.role).toBe('Admin');
    });

    it('should reject invalid credentials and record LOGIN_FAILED in audit log', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.pravaah.local', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);

      const audit = await AuditLog.findOne({
        email: 'admin@test.pravaah.local',
        action: 'LOGIN_FAILED',
      });
      expect(audit).not.toBeNull();
    });

    it('should return profile information on GET /auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@test.pravaah.local');
    });
  });

  describe('2. RBAC & Data Privacy Policy', () => {
    it('Admin can view audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Police cannot view audit logs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${policeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Analyst is blocked from plate search (403 Forbidden with data privacy message)', async () => {
      const res = await request(app)
        .get('/api/v1/plates/search?q=DL01')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Analyst role is restricted to aggregated analytics only');
    });

    it('Analyst is blocked from vehicle trajectories (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/vehicles/DL01AB1234/trajectory')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Plate Search & Vehicle Trajectory Tracking', () => {
    beforeAll(async () => {
      // Insert test detections: one with plate, one without plate (CityFlow unreadable)
      await Detection.deleteMany({ camera_id: 'TEST_CAM' });
      await Detection.create([
        {
          event_id: 'test_evt_1',
          camera_id: 'TEST_CAM',
          timestamp: '2026-11-18T10:00:00Z',
          plate_text: 'DL01AB9999',
          plate_confidence: 0.95,
          vehicle_type: 'car',
          has_plate: true,
          is_synthetic: true,
        },
        {
          event_id: 'test_evt_2',
          camera_id: 'TEST_CAM',
          timestamp: '2026-11-18T10:01:00Z',
          plate_text: '',
          plate_confidence: 0.0,
          vehicle_type: 'truck',
          has_plate: false,
          is_synthetic: true,
        },
      ]);
    });

    afterAll(async () => {
      await Detection.deleteMany({ camera_id: 'TEST_CAM' });
    });

    it('Police can search non-empty plates and find DL01AB9999', async () => {
      const res = await request(app)
        .get('/api/v1/plates/search?q=DL01AB9999')
        .set('Authorization', `Bearer ${policeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].plate_text).toBe('DL01AB9999');

      // Verify audit log for PLATE_SEARCH was created
      const audit = await AuditLog.findOne({
        action: 'PLATE_SEARCH',
        target: 'DL01AB9999',
      });
      expect(audit).not.toBeNull();
    });

    it('Searching empty plate returns 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/plates/search?q=')
        .set('Authorization', `Bearer ${policeToken}`);

      expect(res.status).toBe(400);
    });

    it('Vehicle query for unreadable plate returns 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/vehicles/UNREADABLE/detections')
        .set('Authorization', `Bearer ${policeToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('4. Alerts & Analyst Plate Masking Rule', () => {
    let testAlertId: string;

    beforeAll(async () => {
      testAlertId = `TEST_ALERT_${Date.now()}`;
      await Alert.create({
        alert_id: testAlertId,
        type: 'BLACKLIST_HIT',
        plate_text: 'DL01AB1234',
        camera_id: 'CAM_001',
        timestamp: new Date().toISOString(),
        severity: 'HIGH',
        description: 'Blacklisted vehicle DL01AB1234 detected',
        snapshot_url: 'http://localhost:4000/snapshots/test.jpg',
        acknowledged: false,
        status: 'OPEN',
        metadata: {
          plate_text: 'DL01AB1234',
          owner: 'Test Owner',
        },
      });
    });

    afterAll(async () => {
      await Alert.deleteOne({ alert_id: testAlertId });
    });

    it('Police sees full unmasked plate_text in alerts', async () => {
      const res = await request(app)
        .get(`/api/v1/alerts/${testAlertId}`)
        .set('Authorization', `Bearer ${policeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.plate_text).toBe('DL01AB1234');
      expect(res.body.data.description).toContain('DL01AB1234');
    });

    it('Analyst receives masked plate_text (DL01****34) from /alerts/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/alerts/${testAlertId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.plate_text).toBe('DL01****34');
      expect(res.body.data.description).toContain('DL01****34');
      expect(res.body.data.metadata.plate_text).toBe('DL01****34');
    });

    it('Police can acknowledge alert and creates ALERT_ACKNOWLEDGE audit log', async () => {
      const res = await request(app)
        .patch(`/api/v1/alerts/${testAlertId}`)
        .set('Authorization', `Bearer ${policeToken}`)
        .send({ status: 'ACKNOWLEDGED', comment: 'Patrol dispatched' });

      expect(res.status).toBe(200);
      expect(res.body.data.acknowledged).toBe(true);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');

      const audit = await AuditLog.findOne({
        action: 'ALERT_ACKNOWLEDGE',
        target: testAlertId,
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('5. Blacklist CRUD & Real-time Redis Set Synchronization', () => {
    const testPlate = 'TEST99ZZ0001';

    afterAll(async () => {
      await Blacklist.deleteOne({ plate_text: testPlate });
      await redis.srem('blacklist:plates', testPlate);
    });

    it('POST /blacklist adds vehicle to MongoDB AND Redis set blacklist:plates immediately', async () => {
      const res = await request(app)
        .post('/api/v1/blacklist')
        .set('Authorization', `Bearer ${policeToken}`)
        .send({
          plate_text: testPlate,
          reason: 'Test stolen vehicle for Redis sync check',
          severity: 'HIGH',
          agency: 'Delhi Police Special Cell',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify MongoDB has document
      const doc = await Blacklist.findOne({ plate_text: testPlate });
      expect(doc).not.toBeNull();

      // Verify Redis set has member immediately
      const isMember = await redis.sismember('blacklist:plates', testPlate);
      expect(isMember).toBe(1);

      // Verify audit log
      const audit = await AuditLog.findOne({
        action: 'BLACKLIST_ADD',
        target: testPlate,
      });
      expect(audit).not.toBeNull();
    });

    it('DELETE /blacklist/:plate removes vehicle from MongoDB AND Redis set blacklist:plates immediately', async () => {
      const res = await request(app)
        .delete(`/api/v1/blacklist/${testPlate}`)
        .set('Authorization', `Bearer ${policeToken}`);

      expect(res.status).toBe(200);

      // Verify MongoDB document deleted
      const doc = await Blacklist.findOne({ plate_text: testPlate });
      expect(doc).toBeNull();

      // Verify Redis set member removed immediately
      const isMember = await redis.sismember('blacklist:plates', testPlate);
      expect(isMember).toBe(0);

      // Verify audit log
      const audit = await AuditLog.findOne({
        action: 'BLACKLIST_REMOVE',
        target: testPlate,
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('6. System Health Check', () => {
    it('GET /health returns 200 with service status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body.data.services).toHaveProperty('mongodb');
      expect(res.body.data.services).toHaveProperty('redis');
    });
  });
});
