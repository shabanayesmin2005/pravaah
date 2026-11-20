// ─────────────────────────────────────────────────────────────────────────────
// mongo/init-db.js — MongoDB initialisation script
// Runs once when the container is first started (via docker-entrypoint-initdb.d).
// Creates the application user and indexes for the pravaah database.
// ─────────────────────────────────────────────────────────────────────────────

// Switch to the application database
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'pravaah');

// Create app user (read/write on pravaah and pravaah_test dbs)
db.createUser({
  user: process.env.MONGO_APP_USER || 'pravaah_user',
  pwd: process.env.MONGO_APP_PASSWORD || 'pravaah_pass',
  roles: [
    { role: 'readWrite', db: process.env.MONGO_INITDB_DATABASE || 'pravaah' },
    { role: 'dbOwner', db: 'pravaah_test' },
  ],
});

print('✓ Application user created.');

// ─── Collections & Indexes ───────────────────────────────────────────────────

// detections
db.createCollection('detections');
db.detections.createIndex({ event_id: 1 }, { unique: true });
db.detections.createIndex({ camera_id: 1, timestamp: -1 });
db.detections.createIndex({ plate_text: 1, timestamp: -1 });
db.detections.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90-day TTL (default)
db.detections.createIndex({ track_id: 1, camera_id: 1 });

// trajectories
db.createCollection('trajectories');
db.trajectories.createIndex({ plate_text: 1, created_at: -1 });
db.trajectories.createIndex({ 'waypoints.camera_id': 1 });
db.trajectories.createIndex({ impossible_travel: 1 });

// alerts
db.createCollection('alerts');
db.alerts.createIndex({ type: 1, created_at: -1 });
db.alerts.createIndex({ plate_text: 1 });
db.alerts.createIndex({ camera_id: 1 });
db.alerts.createIndex({ status: 1, severity: 1 });

// blacklist
db.createCollection('blacklist');
db.blacklist.createIndex({ plate_text: 1 }, { unique: true });
db.blacklist.createIndex({ added_at: -1 });

// cameras
db.createCollection('cameras');
db.cameras.createIndex({ id: 1 }, { unique: true });

// analytics_windows
db.createCollection('analytics_windows');
db.analytics_windows.createIndex({ camera_id: 1, window_start: -1 });
db.analytics_windows.createIndex({ window_size_min: 1, window_start: -1 });

// users
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// audit_logs
db.createCollection('audit_logs');
db.audit_logs.createIndex({ user_id: 1, timestamp: -1 });
db.audit_logs.createIndex({ action: 1, timestamp: -1 });
db.audit_logs.createIndex({ timestamp: -1 });

print('✓ Collections and indexes created.');
print('✓ MongoDB initialisation complete.');
