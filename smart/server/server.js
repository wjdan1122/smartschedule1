console.log("✅✅✅ SMART SCHEDULE SERVER - FULL VERSION ✅✅✅");

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const nodemailer = require('nodemailer'); 
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5000;

// ================== MIDDLEWARE ========================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://smartschedule1-b64l.onrender.com',
    'https://endearing-kulfi-c96605.netlify.app'
  ],
  credentials: true,
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// ================== LOGGING MIDDLEWARE ========================
app.use((req, res, next) => {
  console.log('📨 Incoming Request:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  next();
});

// ================== DB POOL ================================
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// ================== AUTH MIDDLEWARE ========================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('🔐 Auth check - Token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    console.log('✅ Authenticated user:', user);
    next();
  });
};

const requireStaff = (req, res, next) => {
  if (req.user && (req.user.role === 'staff' || req.user.role === 'admin' || req.user.role === 'scheduler' || req.user.role === 'committee')) {
    next();
  } else {
    res.status(403).json({ error: 'Staff access required' });
  }
};

const requireCommitteeRole = (req, res, next) => {
  if (req.user && (req.user.role === 'committee' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Committee access required' });
  }
};

// ================== DEBUG ROUTES ========================
app.get('/api/debug/db-connection', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    res.json({ 
      dbConnection: '✅ OK', 
      currentTime: result.rows[0].current_time,
      dbVersion: result.rows[0].db_version,
      dbConfig: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        port: process.env.DB_PORT
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      dbConnection: '❌ FAILED', 
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.get('/api/debug/tables', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({ 
      tableCount: result.rows.length,
      tables: result.rows 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/debug/full-check', async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. فحص الاتصال
    const dbCheck = await client.query('SELECT NOW() as time');
    
    // 2. فحص الجداول
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // 3. فحص البيانات
    const usersCount = await client.query("SELECT COUNT(*) FROM users");
    const studentsCount = await client.query("SELECT COUNT(*) FROM students");
    const votesCount = await client.query("SELECT COUNT(*) FROM votes");
    const coursesCount = await client.query("SELECT COUNT(*) FROM courses");
    
    res.json({
      database: {
        connection: '✅ Connected',
        currentTime: dbCheck.rows[0].time
      },
      tables: {
        count: tables.rows.length,
        list: tables.rows.map(t => t.table_name)
      },
      data: {
        totalUsers: parseInt(usersCount.rows[0].count),
        totalStudents: parseInt(studentsCount.rows[0].count),
        totalVotes: parseInt(votesCount.rows[0].count),
        totalCourses: parseInt(coursesCount.rows[0].count)
      },
      environment: {
        dbHost: process.env.DB_HOST ? '✅ Set' : '❌ Missing',
        dbName: process.env.DB_NAME ? '✅ Set' : '❌ Missing',
        dbUser: process.env.DB_USER ? '✅ Set' : '❌ Missing',
        dbPort: process.env.DB_PORT ? '✅ Set' : '❌ Missing',
        jwtSecret: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Debug check failed',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// ================== AUTH ROUTES ========================
app.post('/api/auth/login', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt for:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const query = `
      SELECT u.user_id, u.name, u.email, u.password, u.role,
             s.student_id, s.level, s.is_ir
      FROM users u
      LEFT JOIN students s ON u.user_id = s.user_id
      WHERE u.email = $1
    `;
    const result = await client.query(query, [email]);

    if (result.rows.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Incorrect credentials' });
    }

    const user = result.rows[0];
    console.log('👤 User found:', { id: user.user_id, role: user.role });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Incorrect credentials' });
    }

    let tokenPayload;
    let userResponse;

    if (user.role === 'student') {
      tokenPayload = { 
        id: user.student_id, 
        user_id: user.user_id, 
        email: user.email, 
        type: 'student',
        role: 'student'
      };
      userResponse = {
        id: user.student_id,
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        level: user.level,
        is_ir: user.is_ir,
        type: 'student',
        role: 'student',
      };
    } else {
      tokenPayload = { 
        id: user.user_id, 
        email: user.email, 
        role: user.role, 
        type: 'user' 
      };
      userResponse = {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        type: 'user',
      };
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    console.log('✅ Login successful for:', email);
    res.json({
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  } finally {
    client.release();
  }
});

// ================== STATISTICS ROUTE ========================
app.get('/api/statistics', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('📊 Fetching statistics for user:', req.user);
    
    const [
      studentsResult,
      votesResult,
      votingStudentsResult,
      commentsResult,
    ] = await Promise.all([
      client.query("SELECT COUNT(*) FROM users WHERE role = 'student'"),
      client.query('SELECT COUNT(*) FROM votes'),
      client.query('SELECT COUNT(DISTINCT student_id) FROM votes'),
      client.query('SELECT COUNT(*) FROM comments'),
    ]);

    console.log('📈 Raw query results:', {
      students: studentsResult.rows[0],
      votes: votesResult.rows[0],
      votingStudents: votingStudentsResult.rows[0],
      comments: commentsResult.rows[0]
    });

    const totalStudents = parseInt(studentsResult.rows[0]?.count || 0, 10);
    const totalVotes = parseInt(votesResult.rows[0]?.count || 0, 10);
    const votingStudents = parseInt(votingStudentsResult.rows[0]?.count || 0, 10);
    const totalComments = parseInt(commentsResult.rows[0]?.count || 0, 10);

    const participationRate = totalStudents > 0 
      ? (votingStudents / totalStudents) * 100 
      : 0;

    const stats = {
      totalStudents,
      totalVotes,
      votingStudents,
      totalComments,
      participationRate: Number(participationRate).toFixed(1),
    };

    console.log('✅ Final statistics:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Statistics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// ================== STUDENT ROUTES ========================
app.get('/api/students', authenticateToken, requireStaff, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT s.student_id, s.is_ir, s.level, u.email, u.name
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      ORDER BY s.student_id
    `;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Error fetching students' });
  } finally {
    client.release();
  }
});

app.get('/api/student/:user_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_id } = req.params;
    const query = `
      SELECT s.student_id, s.is_ir, s.level,
             u.user_id, u.email, u.name
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      WHERE u.user_id = $1
    `;
    const result = await client.query(query, [user_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Error fetching student data' });
  } finally {
    client.release();
  }
});

// ================== COURSE ROUTES ========================
app.get('/api/courses', async (req, res) => {
  const client = await pool.connect();
  try {
    const { level, department } = req.query;
    let query = 'SELECT * FROM courses';
    const queryParams = [];

    if (level) {
      queryParams.push(level);
      query += ` WHERE level = $${queryParams.length}`;
    }

    if (department) {
      queryParams.push(department);
      query += queryParams.length === 1 ? ' WHERE' : ' AND';
      query += ` dept_code = $${queryParams.length}`;
    }

    query += ' ORDER BY level, name';
    const result = await client.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Error fetching courses' });
  } finally {
    client.release();
  }
});

// ================== SCHEDULE ROUTES ========================
app.get('/api/schedules/level/:level', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level } = req.params;
    const scheduleQuery = `
      SELECT * FROM schedule_versions
      WHERE level = $1 AND is_active = true AND committee_approved = true
      LIMIT 1
    `;
    const scheduleResult = await client.query(scheduleQuery, [level]);
    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ message: `No active schedule found for level ${level}.` });
    }
    const activeSchedule = scheduleResult.rows[0];
    res.json({ schedule: activeSchedule, comments: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch schedule data.' });
  } finally {
    client.release();
  }
});

// ================== USER ROUTES ========================
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    res.json({ 
      user: req.user,
      message: 'User profile retrieved successfully' 
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ================== BASIC ROUTES ========================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'SmartSchedule Server is running!',
    endpoints: {
      debug: '/api/debug/full-check',
      health: '/api/health',
      login: '/api/auth/login',
      statistics: '/api/statistics'
    }
  });
});

// ================== ERROR HANDLING ========================
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

// ================== START SERVER ========================
server.listen(PORT, () => {
  console.log(`🚀 SmartSchedule Server running on port ${PORT}`);
  console.log(`📊 Debug URL: http://localhost:${PORT}/api/debug/full-check`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
});

// ================== GRACEFUL SHUTDOWN ========================
let shuttingDown = false;
const gracefulShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('🔄 Shutting down server gracefully...');
  
  wss.clients.forEach((client) => {
    try {
      client.terminate();
    } catch {}
  });
  
  wss.close(() => console.log('WebSocket server closed'));
  
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
