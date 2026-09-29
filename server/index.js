require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

let lastError = null;
app.get('/api/debug', (req, res) => {
  res.json({ lastError: lastError ? lastError.message || lastError : "No errors" });
});


// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Basic Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TPS Backend is running!' });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// 1. Sign Up
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name, avatar } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  try {
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password, name, avatar) VALUES ($1, $2, $3, $4) RETURNING id, email, name, avatar, role',
      [email, passwordHash, name, avatar || '👤']
    );

    const user = result.rows[0];
    res.status(201).json({ user, message: 'User created successfully' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare passwords
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch user progress
    const progressResult = await pool.query('SELECT course_id, status FROM course_progress WHERE user_id = $1', [user.id]);
    
    // Format progress as a map: { "risk-aml": { unlocked: true, status: 'completed' }, ... }
    const progressMap = {};
    progressResult.rows.forEach(row => {
      progressMap[row.course_id] = {
        unlocked: true,
        status: row.status
      };
    });

    // Remove password from returned object
    delete user.password;

    res.json({
      user: {
        ...user,
        enrollments: progressMap
      },
      message: 'Logged in successfully'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ==========================================
// AUTO-INITIALIZE DATABASE V2 (Sync Tables)
// ==========================================
app.get('/api/init-v2', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        profile_id INTEGER REFERENCES users(id),
        course_id VARCHAR(255),
        scenario_id VARCHAR(255),
        attempt INTEGER DEFAULT 1,
        composite INTEGER,
        points INTEGER,
        net INTEGER,
        sim_day INTEGER,
        outcome VARCHAR(50),
        mistakes JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS sessions_profile_idx ON sessions(profile_id, course_id);
    `);
    res.json({ message: 'Sync tables created successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POLYFILL POSTGREST ROUTES FOR FRONTEND SYNC
// ==========================================

// Fake profiles endpoint for health checking cloud connectivity
app.get('/profiles', (req, res) => {
  res.json([{ team: "connected" }]);
});

// Save Sessions (from flushOutbox)
app.post('/sessions', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    for (const s of payload) {
      await pool.query(`
        INSERT INTO sessions (id, profile_id, course_id, scenario_id, attempt, composite, points, net, sim_day, outcome, mistakes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, CURRENT_TIMESTAMP))
        ON CONFLICT (id) DO NOTHING
      `, [s.id, s.profile_id, s.course_id, s.scenario_id, s.attempt, s.composite, s.points, s.net, s.sim_day, s.outcome, s.mistakes ? JSON.stringify(s.mistakes) : null, s.created_at || null]);
    }
    res.json({ message: "Saved" });
  } catch(err) {
    console.error("Save session error:", err); lastError = err;
    res.status(500).json({ error: err.message });
  }
});

// Fetch Sessions (when logging in on another device)
app.get('/sessions', async (req, res) => {
  try {
    const profileIdStr = req.query.profile_id;
    if (!profileIdStr || !profileIdStr.startsWith('eq.')) {
      // Just a probe or invalid request
      return res.json([]);
    }
    const profileId = parseInt(profileIdStr.replace('eq.', ''), 10);

    let courseId = null;
    const cStr = req.query.course_id;
    if(cStr && cStr.startsWith('eq.')) { courseId = cStr.replace('eq.', ''); }
    
    let result;
    if(courseId) {
      result = await pool.query(`
        SELECT course_id, scenario_id, points, net, attempt, composite, created_at, id
        FROM sessions
        WHERE profile_id = $1 AND course_id = $2
        ORDER BY created_at ASC
      `, [profileId, courseId]);
    } else {
      result = await pool.query(`
        SELECT course_id, scenario_id, points, net, attempt, composite, created_at, id
        FROM sessions
        WHERE profile_id = $1
        ORDER BY created_at ASC
      `, [profileId]);
    }

    res.json(result.rows);
  } catch(err) {
    console.error("Fetch session error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Fake Leaderboard Routes to prevent 404s breaking the frontend state
app.get('/leaderboard', (req, res) => {
  res.json([]);
});

app.get('/leaderboard_days', (req, res) => {
  res.json([]);
});

app.post('/enrollments', (req, res) => {
  res.json({ message: "Enrollment saved" });
});

app.patch('/profiles', (req, res) => {
  res.json({ message: "Profile updated" });
});

// Fake events route for telemetry shipEvent()
app.post('/events', (req, res) => {
  res.json({ message: "Events discarded" });
});


// ==========================================
// PROGRESS ROUTES
// ==========================================

// 3. Save Progress
app.post('/api/progress', async (req, res) => {
  const { user_id, course_id, status } = req.body;

  if (!user_id || !course_id || !status) {
    return res.status(400).json({ error: 'user_id, course_id, and status are required' });
  }

  try {
    // Upsert progress
    await pool.query(`
      INSERT INTO course_progress (user_id, course_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET status = $3, created_at = CURRENT_TIMESTAMP
    `, [user_id, course_id, status]);

    res.json({ message: 'Progress saved successfully' });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ==========================================
// AUTO-INITIALIZE DATABASE
// ==========================================
app.get('/api/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS course_progress (
        user_id INTEGER REFERENCES users(id),
        course_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, course_id)
      );
    `);
    res.json({ message: 'Database tables created successfully!' });
  } catch (err) {
    console.error('DB Init Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
