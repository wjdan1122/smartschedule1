// تم دمج كل المسارات في هذا الكود: auth, stats, rules, comments, students.

console.log("✅✅✅ RUNNING THE LATEST SERVER.JS FILE ✅✅✅");
console.log("👉 Running THIS server.js from smart3/smart/server");

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const nodemailer = require('nodemailer'); 
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const COLLAB_NAMESPACE = 'collaboration';
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5000;

// ================== MIDDLEWARE الأساسي ========================
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

// ================== MIDDLEWARE المخصص والتحقق ========================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
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

const requireScheduler = (req, res, next) => {
  if (req.user && (req.user.role === 'scheduler' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Scheduler access required' });
  }
};

const requireFaculty = (req, res, next) => {
  if (req.user && (req.user.role === 'faculty' || req.user.role === 'admin' || req.user.role === 'committee')) {
    next();
  } else {
    res.status(403).json({ error: 'Faculty access required' });
  }
};

const requireOwnDataOrStaff = (req, res, next) => {
  const { user_id } = req.params;
  if (req.user && (req.user.id == user_id || req.user.role === 'staff' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  req.validatedData = { email, password };
  next();
};

const validateUserRegistration = (req, res, next) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  req.validatedData = { email, password, name, role };
  next();
};

const validateStudentRegistration = (req, res, next) => {
  const { email, password, name, level, is_ir } = req.body;
  if (!email || !password || !name || !level) {
    return res.status(400).json({ error: 'Email, password, name, and level are required' });
  }
  req.validatedData = { email, password, name, level, is_ir: is_ir || false };
  next();
};

const validateStudentUpdate = (req, res, next) => {
  const { studentId, level } = req.body;
  if (!studentId || !level) {
    return res.status(400).json({ error: 'Student ID and level are required' });
  }
  req.validatedData = { studentId, level };
  next();
};


// =============== EMAIL TRANSPORTER ==================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error verifying mail transporter:', error);
  } else {
    console.log('✅ Mail transporter is ready to send messages');
  }
});

// ================== WEBSOCKET ===============================
wss.on('connection', (ws, req) => {
  const pathName = (req.url || '').split('?')[0];
  const segments = pathName.split('/').filter(Boolean);
  if (segments[0] !== COLLAB_NAMESPACE) {
    ws.close(1008, 'Unknown collaboration namespace');
    return;
  }
  const docName = segments[1] || 'shared-rules';
  console.log(`[collaboration] client connected to room: ${docName}`);
  // استخدام WebSocket الأساسي بدل setupWSConnection
  ws.on('message', (message) => {
    // معالجة الرسائل الأساسية
    console.log('Received message:', message);
  });
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
  keepAlive: true,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL database:', err.stack);
  } else {
    console.log('✅ Successfully connected to PostgreSQL database');
    release();
  }
});

// ================== MIGRATIONS (معطلة) =============================
async function runMigrations() {
  console.log('[migrate] Skipping migrations to avoid SQL syntax errors.');
  return;
}

runMigrations().catch(() => {});

// ==========================================================
// AUTH ROUTES
// ==========================================================
app.post('/api/auth/login', validateLogin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.validatedData;
    
    // الاستعلام المصحح لتسجيل الدخول
    const query = `
      SELECT u.user_id, u.name, u.email, u.password, u.role,
             s.student_id, s.level, s.is_ir
      FROM users u
      LEFT JOIN students s ON u.user_id = s.user_id
      WHERE u.email = $1
    `;
    const result = await client.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect credentials' });
    }

    if (user.role === 'student') {
      let studentId = user.student_id;
      let level = user.level;
      let is_ir = user.is_ir;

      if (!studentId) {
        const studentResult = await client.query(
          'SELECT student_id, level, is_ir FROM students WHERE user_id = $1',
          [user.user_id]
        );
        if (studentResult.rowCount > 0) {
          studentId = studentResult.rows[0].student_id;
          level = studentResult.rows[0].level;
          is_ir = studentResult.rows[0].is_ir;
        }
      }

      const token = jwt.sign(
        { id: studentId, user_id: user.user_id, email: user.email, type: 'student' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: studentId,
          user_id: user.user_id,
          email: user.email,
          name: user.name,
          level,
          is_ir,
          type: 'student',
          role: 'student',
        },
      });
    }

    const token = jwt.sign(
      { id: user.user_id, email: user.email, role: user.role, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        type: 'user',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ========== FORGOT PASSWORD =================
app.post('/api/auth/forgot-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const userCheck = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userCheck.rows.length === 0) {
      return res.json({
        message: 'If an account exists, reset instructions have been sent.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expireDate = new Date(Date.now() + 3600000);

    await client.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetToken, expireDate, email]
    );

    const resetLink = `https://endearing-kulfi-c96605.netlify.app/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'SmartSchedule - Reset Password',
      html: `<p>You requested a password reset.</p>
             <p>Click here to reset: <a href="${resetLink}">Reset Password</a></p>`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Reset email sent:', info.messageId);

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  } finally {
    client.release();
  }
});

// ========== RESET PASSWORD ==================
app.post('/api/auth/reset-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and newPassword are required.' });
    }

    const result = await client.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
      [hashedPassword, result.rows[0].user_id]
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client.release();
  }
});

// ==========================================================
// REGISTER ROUTES
// ==========================================================
app.post('/api/auth/register-user', validateUserRegistration, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, name, role } = req.validatedData;
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (email, password, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, email, name, role
    `;
    const result = await client.query(query, [email, hashedPassword, name, role]);
    res.json({ success: true, message: 'User added successfully!', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Error creating user' });
    }
  } finally {
    client.release();
  }
});

app.post('/api/auth/register-student', validateStudentRegistration, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { email, password, name, level, is_ir } = req.validatedData;
    const hashedPassword = await bcrypt.hash(password, 10);

    const userQuery = `
      INSERT INTO users (email, password, name, role)
      VALUES ($1, $2, $3, 'student')
      RETURNING user_id
    `;
    const userResult = await client.query(userQuery, [email, hashedPassword, name]);
    const userId = userResult.rows[0].user_id;

    const studentQuery = `
      INSERT INTO students (user_id, level, is_ir)
      VALUES ($1, $2, $3)
      RETURNING student_id
    `;
    const studentResult = await client.query(studentQuery, [userId, level, is_ir || false]);

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Student added successfully!',
      studentId: studentResult.rows[0].student_id,
      userId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Error creating student' });
    }
  } finally {
    client.release();
  }
});

// ==========================================================
// STUDENT ROUTES
// ==========================================================
app.get('/api/student/:user_id', authenticateToken, requireOwnDataOrStaff, async (req, res) => {
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

// ==========================================================
// COURSE ROUTES
// ==========================================================
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

// ==========================================================
// STATISTICS ROUTES (تمت إضافته)
// ==========================================================
app.get('/api/statistics', authenticateToken, requireStaff, async (req, res) => {
  const client = await pool.connect();
  try {
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

    const totalStudents = parseInt(studentsResult.rows[0].count, 10);
    const totalVotes = parseInt(votesResult.rows[0].count, 10);
    const votingStudents = parseInt(votingStudentsResult.rows[0].count, 10);
    const totalComments = parseInt(commentsResult.rows[0].count, 10);

    const participationRate =
      totalStudents > 0 ? (votingStudents / totalStudents) * 100 : 0;

    res.json({
      totalStudents,
      totalVotes,
      votingStudents,
      totalComments,
      participationRate: Number(participationRate).toFixed(1),
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics. Check if tables exist.' });
  } finally {
    client.release();
  }
});

// ==========================================================
// RULES ROUTES (تمت إضافته)
// ==========================================================
app.get('/api/rules', authenticateToken, requireStaff, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = 'SELECT rule_id, text FROM rules ORDER BY rule_id';
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rules.' });
  } finally {
    client.release();
  }
});

app.post('/api/rules', authenticateToken, requireStaff, async (req, res) => {
  const client = await pool.connect();
  try {
    const { text } = req.body;
    const query = 'INSERT INTO rules (text) VALUES ($1) RETURNING *';
    const result = await client.query(query, [text]);
    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add rule.' });
  } finally {
    client.release();
  }
});

// ==========================================================
// COMMENTS ROUTES (تمت إضافته)
// ==========================================================
app.get('/api/comments/all', authenticateToken, requireStaff, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT c.id as comment_id, c.comment, c.created_at,
             s.student_id, s.level as student_level,
             u.name as student_name,
             sv.id as schedule_version_id, sv.version_comment
      FROM comments c
      LEFT JOIN students s ON c.student_id = s.student_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN schedule_versions sv ON c.schedule_version_id = sv.id
      WHERE c.user_id IS NULL
      ORDER BY c.created_at DESC;
    `;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all comments.' });
  } finally {
    client.release();
  }
});

// ================== ROUTES الأساسية ========================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK-V2', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'SmartSchedule Server is running!' });
});

// ================== START SERVER ========================
server.listen(PORT, () => {
  console.log(`✅ SmartSchedule Server running on port ${PORT}`);
  console.log(`✅ Connected to PostgreSQL database: ${process.env.DB_NAME}`);
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
