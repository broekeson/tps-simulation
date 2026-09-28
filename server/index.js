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

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
