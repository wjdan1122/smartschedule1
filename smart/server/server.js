console.log("✅✅✅ RUNNING THE LATEST SERVER.JS FILE (OpenAI Ready & FINAL RESPONSE FORMAT FIX) ✅✅✅");
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
const { setupWSConnection } = require('y-websocket/bin/utils');
// 👇 استيراد مكتبة الإيميلات
const nodemailer = require('nodemailer');
require('dotenv').config();

// ✨ Phase 1: Import validation and authentication middleware
const {
  requireScheduler,
  requireCommitteeRole,
  requireFaculty,
  requireStaff,
  requireStudent,
  requireOwnData,
  requireOwnDataOrStaff,
  verifyCommitteePassword
} = require('./middleware/auth');

const {
  validateUserRegistration,
  validateStudentRegistration,
  validateLogin,
  validateStudentUpdate,
  validateCourseCreation,
  validateComment,
  validateVote,
  validateScheduleVersion,
  validateRule,
  validateIdParam
} = require('./middleware/validation');

const app = express();
const server = http.createServer(app);
const COLLAB_NAMESPACE = 'collaboration';
const wss = new WebSocket.Server({ server });

// 👇 run backend on 5000
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://smartschedule1-b64l.onrender.com',
      'https://endearing-kulfi-c96605.netlify.app' // ✅ رابط موقعك
    ],
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ إعداد خدمة البريد الإلكتروني
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // سيتم جلبه من Render
    pass: process.env.EMAIL_PASS  // سيتم جلبه من Render
  }
});

wss.on('connection', (ws, req) => {
  const pathName = (req.url || '').split('?')[0];
  const segments = pathName.split('/').filter(Boolean);
  if (segments[0] !== COLLAB_NAMESPACE) {
    ws.close(1008, 'Unknown collaboration namespace');
    return;
  }
  const docName = segments[1] || 'shared-rules';
  console.log(`[collaboration] client connected to room: ${docName}`);
  setupWSConnection(ws, req, { docName, gc: true });
});

wss.on('error', (err) => {
  console.error('[collaboration] websocket error:', err);
});

// PostgreSQL Connection Pool
const sslConfig = process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : undefined;
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
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

async function runMigrations() {
  const dir = path.join(__dirname, 'migrations');
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.sql')).sort();
    if (files.length === 0) return;
    const client = await pool.connect();
    try {
      for (const f of files) {
        const full = path.join(dir, f);
        const sql = fs.readFileSync(full, 'utf8');
        await client.query(sql);
      }
      console.log('[migrate] Completed');
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[migrate] Migration error:', e);
  }
}

runMigrations().catch(() => { });

// ============================================
// AUTHENTICATION ROUTES
// ============================================

app.post('/api/auth/login', validateLogin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.validatedData;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const query = `SELECT u.user_id, u.name, u.email, u.password, u.role, s.student_id, s.level, s.is_ir FROM users u LEFT JOIN students s ON u.user_id = s.user_id WHERE u.email = $1`;
    const result = await client.query(query, [email]);

    if (result.rows.length === 0) return res.status(401).json({ error: 'Incorrect credentials' });
    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Incorrect credentials' });

    if (user.role === 'student') {
      let studentId = user.student_id;
      let level = user.level;
      let is_ir = user.is_ir;

      if (!studentId) {
        const studentResult = await client.query('SELECT student_id, level, is_ir FROM students WHERE user_id = $1', [user.user_id]);
        if (studentResult.rowCount > 0) {
          studentId = studentResult.rows[0].student_id;
          level = studentResult.rows[0].level;
          is_ir = studentResult.rows[0].is_ir;
        }
      }
      const token = jwt.sign({ id: studentId, user_id: user.user_id, email: user.email, type: 'student' }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { id: studentId, user_id: user.user_id, email: user.email, name: user.name, level, is_ir, type: 'student', role: 'student' } });
    }

    const token = jwt.sign({ id: user.user_id, email: user.email, role: user.role, type: 'user' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: user.user_id, email: user.email, name: user.name, role: user.role, type: 'user' } });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ✅ (جديد) مسار طلب إعادة تعيين كلمة المرور
app.post('/api/auth/forgot-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = req.body;
    const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userCheck.rows.length === 0) {
      return res.json({ message: 'If an account exists, reset instructions have been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expireDate = new Date(Date.now() + 3600000); // 1 hour

    await client.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3', [resetToken, expireDate, email]);

    // رابط الصفحة في Netlify
    const resetLink = `https://endearing-kulfi-c96605.netlify.app/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'SmartSchedule - Reset Password',
      html: `<p>You requested a password reset.</p><p>Click here to reset: <a href="${resetLink}">Reset Password</a></p>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });

  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  } finally {
    client.release();
  }
});

// ✅ (جديد) مسار حفظ كلمة المرور الجديدة
app.post('/api/auth/reset-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, newPassword } = req.body;
    const result = await client.query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]);

    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2', [hashedPassword, result.rows[0].user_id]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/register-user', validateUserRegistration, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, name, role } = req.validatedData;
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING user_id, email, name, role`;
    const result = await client.query(query, [email, hashedPassword, name, role]);
    res.json({ success: true, message: 'User added successfully!', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') res.status(400).json({ error: 'Email already exists' });
    else res.status(500).json({ error: 'Error creating user' });
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
    const userQuery = `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, 'student') RETURNING user_id`;
    const userResult = await client.query(userQuery, [email, hashedPassword, name]);
    const userId = userResult.rows[0].user_id;
    const studentQuery = `INSERT INTO students (user_id, level, is_ir) VALUES ($1, $2, $3) RETURNING student_id`;
    const studentResult = await client.query(studentQuery, [userId, level, is_ir || false]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Student added successfully!', studentId: studentResult.rows[0].student_id, userId });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') res.status(400).json({ error: 'Email already exists' });
    else res.status(500).json({ error: 'Error creating student' });
  } finally {
    client.release();
  }
});

// ============================================
// STUDENT ROUTES
// ============================================

app.get('/api/schedules/level/:level', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level } = req.params;
    const scheduleQuery = 'SELECT * FROM schedule_versions WHERE level = $1 AND is_active = true AND committee_approved = true LIMIT 1';
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

app.get('/api/student/:user_id', authenticateToken, requireOwnDataOrStaff, async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_id } = req.params;
    const query = `
          SELECT s.student_id, s.is_ir, s.level, u.user_id, u.email, u.name, 0 as total_courses
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

app.get('/api/students', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `SELECT s.student_id, s.is_ir, s.level, u.email, u.name FROM students s JOIN users u ON s.user_id = u.user_id ORDER BY s.student_id`;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Error fetching students' });
  } finally {
    client.release();
  }
});

app.put('/api/students/:id', authenticateToken, requireStaff, validateStudentUpdate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { studentId, level } = req.validatedData;
    const query = `UPDATE students SET level = $1 WHERE student_id = $2 RETURNING student_id, level`;
    const result = await client.query(query, [level, studentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    res.json({ success: true, message: 'Student level updated successfully!', student: result.rows[0] });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Failed to update student.' });
  } finally {
    client.release();
  }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const studentQuery = await client.query('SELECT user_id FROM students WHERE student_id = $1', [id]);
    if (studentQuery.rows.length === 0) {
      throw new Error('Student not found.');
    }
    const { user_id } = studentQuery.rows[0];
    await client.query('DELETE FROM students WHERE student_id = $1', [id]);
    await client.query('DELETE FROM users WHERE user_id = $1', [user_id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student.' });
  } finally {
    client.release();
  }
});

app.put('/api/student/level-up/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const studentRes = await client.query('SELECT level, has_leveled_up FROM students WHERE student_id=$1', [id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRes.rows[0];
    if (student.has_leveled_up) {
      return res.status(400).json({ error: 'Level already increased once' });
    }
    const newLevel = student.level + 1;
    await client.query('UPDATE students SET level=$1, has_leveled_up=true WHERE student_id=$2', [newLevel, id]);
    res.json({ success: true, message: `Level updated to ${newLevel}` });
  } catch (err) {
    console.error('Level-up error:', err);
    res.status(500).json({ error: 'Server error during level up' });
  } finally {
    client.release();
  }
});

// ============================================
// COURSE ROUTES
// ============================================
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

app.get('/api/courses/elective', async (req, res) => {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM courses WHERE is_elective = true ORDER BY level, name';
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching elective courses:', error);
    res.status(500).json({ error: 'Error fetching elective courses' });
  } finally {
    client.release();
  }
});

app.post('/api/courses', validateUserRegistration, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, credit, level, is_elective, dept_code } = req.validatedData;
    const query = `INSERT INTO courses (name, credit, level, is_elective, dept_code) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const result = await client.query(query, [name, credit, level, is_elective || false, dept_code]);
    res.json({ success: true, message: 'Course added successfully!', course: result.rows[0] });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Error adding course' });
  } finally {
    client.release();
  }
});

// ============================================
// VOTING & APPROVAL ROUTES
// ============================================
app.post('/api/vote', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id, course_id, vote_value } = req.body;
    const query = `
        INSERT INTO votes (student_id, course_id, vote_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (student_id, course_id)
        DO UPDATE SET vote_value = $3, voted_at = NOW();
    `;
    await client.query(query, [student_id, course_id, vote_value]);
    res.json({ success: true, message: 'Vote recorded successfully!' });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Error recording vote' });
  } finally {
    client.release();
  }
});

app.get('/api/votes/student/:student_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id } = req.params;
    const query = 'SELECT course_id, vote_value FROM votes WHERE student_id = $1';
    const result = await client.query(query, [student_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student votes:', error);
    res.status(500).json({ error: 'Failed to fetch student votes.' });
  } finally {
    client.release();
  }
});

app.get('/api/votes/results', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
          SELECT c.course_id, c.name, c.is_approved, s.level AS student_level, COUNT(v.vote_id) AS vote_count
          FROM courses c
          LEFT JOIN votes v ON c.course_id = v.course_id
          LEFT JOIN students s ON v.student_id = s.student_id
          WHERE c.is_elective = true
          GROUP BY c.course_id, c.name, c.is_approved, s.level
          ORDER BY c.course_id, s.level;
        `;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching voting results:', error);
    res.status(500).json({ error: 'Failed to fetch voting results.' });
  } finally {
    client.release();
  }
});

app.get('/api/electives/approved', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `SELECT course_id, level FROM approved_electives_by_level ORDER BY level, course_id`;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approved electives:', error);
    res.status(500).json({ error: 'Failed to fetch approved electives.' });
  } finally {
    client.release();
  }
});

app.post('/api/electives/approve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { course_id, level } = req.body;
    if (!course_id || !level) return res.status(400).json({ error: 'Course ID and Level are required.' });
    await client.query('BEGIN');
    const insertQuery = `
          INSERT INTO approved_electives_by_level (course_id, level) 
          VALUES ($1, $2)
          ON CONFLICT (course_id, level) DO NOTHING;
        `;
    await client.query(insertQuery, [course_id, level]);
    await client.query('UPDATE courses SET is_approved = true WHERE course_id = $1', [course_id]);
    await client.query('COMMIT');
    res.json({ success: true, message: `Course ${course_id} approved for Level ${level}.` });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error approving course:', error);
    res.status(500).json({ error: 'Failed to approve course.' });
  } finally {
    client.release();
  }
});

app.delete('/api/electives/approve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { course_id, level } = req.body;
    if (!course_id || !level) return res.status(400).json({ error: 'Course ID and Level are required.' });
    await client.query('BEGIN');
    const deleteResult = await client.query('DELETE FROM approved_electives_by_level WHERE course_id = $1 AND level = $2 RETURNING *', [course_id, level]);
    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Record not found.' });
    }
    const remaining = await client.query('SELECT 1 FROM approved_electives_by_level WHERE course_id = $1 LIMIT 1', [course_id]);
    if (remaining.rows.length === 0) {
      await client.query('UPDATE courses SET is_approved = false WHERE course_id = $1', [course_id]);
    }
    await client.query('COMMIT');
    res.json({ success: true, message: `Course ${course_id} removed from Level ${level}.` });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error removing approved course:', error);
    res.status(500).json({ error: 'Failed to remove approved course.' });
  } finally {
    client.release();
  }
});

// ============================================
// SCHEDULE ROUTES
// ============================================
app.get('/api/schedules', async (req, res) => {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM schedules ORDER BY level, group_number';
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Error fetching schedules' });
  } finally {
    client.release();
  }
});

app.post('/api/schedules', validateUserRegistration, async (req, res) => {
  const client = await pool.connect();
  try {
    const { group_number, level } = req.validatedData;
    const query = `INSERT INTO schedules (group_number, level) VALUES ($1, $2) RETURNING *`;
    const result = await client.query(query, [group_number, level]);
    res.json({ success: true, message: 'Schedule added successfully!', schedule: result.rows[0] });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Error creating schedule' });
  } finally {
    client.release();
  }
});

// ============================================
// SECTION ROUTES
// ============================================
app.get('/api/sections', async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT s.*, c.name AS course_name, c.level AS level, c.dept_code AS dept_code
      FROM sections s
      JOIN courses c ON s.course_id = c.course_id
      ORDER BY c.level, s.day_code, s.start_time
    `;
    const result = await client.query(query);
    const sectionsWithCastedLevel = result.rows.map((row) => ({
      ...row,
      level: row.level != null ? parseInt(row.level, 10) : row.level,
    }));
    res.json(sectionsWithCastedLevel);
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: 'Error fetching sections' });
  } finally {
    client.release();
  }
});

// ============================================
// SCHEDULE VERSION ROUTES
// ============================================
app.get('/api/schedule-versions', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level } = req.query;
    if (!level) return res.status(400).json({ message: 'Level required.' });
    const query = 'SELECT * FROM schedule_versions WHERE level = $1 ORDER BY created_at DESC';
    const result = await client.query(query, [level]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule versions:', error);
    res.status(500).json({ message: 'Failed to fetch schedule versions.' });
  } finally {
    client.release();
  }
});

app.post('/api/schedule-versions', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level, student_count, version_comment, sections } = req.body;
    if (!level || !sections) return res.status(400).json({ message: 'Level and sections required.' });
    const query = `
      INSERT INTO schedule_versions (level, student_count, version_comment, sections)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await client.query(query, [level, student_count, version_comment, JSON.stringify(sections)]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving schedule version:', error);
    res.status(500).json({ message: 'Failed to save schedule version.' });
  } finally {
    client.release();
  }
});

app.patch('/api/schedule-versions/:id/scheduler-approve', authenticateToken, requireScheduler, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { approved } = req.body || {};
    const value = approved === false ? false : true;
    const result = await client.query(
      'UPDATE schedule_versions SET scheduler_approved = $1 WHERE id = $2 RETURNING *',
      [value, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Schedule version not found.' });
    res.json({ success: true, version: result.rows[0] });
  } catch (error) {
    console.error('Error updating scheduler approval:', error);
    res.status(500).json({ message: 'Failed to update scheduler approval.' });
  } finally {
    client.release();
  }
});

app.get('/api/schedule-versions/pending-committee', authenticateToken, requireCommitteeRole, async (req, res) => {
  const client = await pool.connect();
  try {
    const sql = `
      SELECT *
      FROM schedule_versions
      WHERE COALESCE(scheduler_approved, false) = true
        OR is_active = true
      ORDER BY created_at DESC`;
    const result = await client.query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending committee schedules:', error);
    res.status(500).json({ message: 'Failed to fetch pending committee schedules.' });
  } finally {
    client.release();
  }
});

app.patch('/api/schedule-versions/:id/committee-review', authenticateToken, requireCommitteeRole, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { approved, committee_comment } = req.body || {};
    const value = approved === true;
    await client.query('BEGIN');
    const lvlRes = await client.query('SELECT level FROM schedule_versions WHERE id = $1', [id]);
    if (lvlRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Schedule version not found.' });
    }
    const level = lvlRes.rows[0].level;
    if (value) {
      await client.query('UPDATE schedule_versions SET committee_approved = false WHERE level = $1', [level]);
    }
    const updRes = await client.query(
      'UPDATE schedule_versions SET committee_approved = $1, committee_comment = $2 WHERE id = $3 RETURNING *',
      [value, committee_comment || null, id]
    );
    await client.query('COMMIT');
    res.json({ success: true, version: updRes.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { }
    console.error('Error updating committee review:', error);
    res.status(500).json({ message: 'Failed to update committee review.' });
  } finally {
    client.release();
  }
});

app.patch('/api/schedule-versions/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { version_comment } = req.body;
    if (!version_comment || !version_comment.trim()) return res.status(400).json({ message: 'Version name is required.' });
    const query = `UPDATE schedule_versions SET version_comment = $1 WHERE id = $2 RETURNING *`;
    const result = await client.query(query, [version_comment.trim(), id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Schedule version not found.' });
    res.json({ success: true, version: result.rows[0] });
  } catch (error) {
    console.error('Error renaming schedule version:', error);
    res.status(500).json({ message: 'Failed to rename schedule version.' });
  } finally {
    client.release();
  }
});

app.patch('/api/schedule-versions/:id/activate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const levelResult = await client.query('SELECT level FROM schedule_versions WHERE id = $1', [id]);
    if (levelResult.rows.length === 0) throw new Error('Version not found.');
    const { level } = levelResult.rows[0];
    await client.query('UPDATE schedule_versions SET is_active = false WHERE level = $1', [level]);
    await client.query('UPDATE schedule_versions SET is_active = true WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true, message: `Version ${id} activated successfully.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error activating schedule version:', error);
    res.status(500).json({ message: 'Failed to activate schedule version.' });
  } finally {
    client.release();
  }
});

// ============================================
// STATISTICS ROUTES
// ============================================
app.get('/api/statistics', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const [studentsResult, votesResult, votingStudentsResult, commentsResult] = await Promise.all([
      client.query("SELECT COUNT(*) FROM users WHERE role = 'student'"),
      client.query('SELECT COUNT(*) FROM votes'),
      client.query('SELECT COUNT(DISTINCT student_id) FROM votes'),
      client.query('SELECT COUNT(*) FROM comments'),
    ]);
    const totalStudents = parseInt(studentsResult.rows[0].count, 10);
    const totalVotes = parseInt(votesResult.rows[0].count, 10);
    const votingStudents = parseInt(votingStudentsResult.rows[0].count, 10);
    const totalComments = parseInt(commentsResult.rows[0].count, 10);

    const participationRate = totalStudents > 0 ? (votingStudents / totalStudents) * 100 : 0;

    res.json({
      totalStudents,
      totalVotes,
      votingStudents,
      totalComments,
      participationRate: Number(participationRate).toFixed(1),
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  } finally {
    client.release();
  }
});
/*
// ============================================
// AI SCHEDULER ROUTE (SWITCHED TO OPENAI)
// ============================================
app.post('/api/schedule/generate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level, currentLevel, currentSchedule, user_command } = req.body;

    // Basic data gathering (Same as before)
    const rulesResult = await client.query('SELECT text FROM rules ORDER BY rule_id');
    const rules = rulesResult.rows.map(r => r.text);
    const coursesResult = await client.query(
      `SELECT c.course_id, c.name, c.credit, c.dept_code 
       FROM courses c
       LEFT JOIN approved_electives_by_level aebl ON c.course_id = aebl.course_id
       WHERE (c.level = $1 AND c.dept_code = 'SE') OR (aebl.level = $1)`,
      [currentLevel]
    );
    const requiredCourses = coursesResult.rows;
    if (requiredCourses.length === 0) {
      return res.status(404).json({ error: `No Software Engineering courses found for level ${currentLevel}.` });
    }
    const fixedSections = currentSchedule.sections.filter(sec => sec.dept_code !== 'SE');
    const occupiedSlots = fixedSections.map(sec =>
      `${sec.day_code} from ${sec.start_time?.substring(0, 5)} to ${sec.end_time?.substring(0, 5)} for ${sec.dept_code}`
    );

    // Prepare prompt parts (Modified for clarity with OpenAI)
    const systemInstruction = `You are a university academic scheduler AI. Your task is to schedule the provided list of Software Engineering (SE) courses into available slots, following all rules strictly. You MUST treat the 'occupied slots' list as fixed and unmovable. Your final output MUST be a JSON array ONLY.`;
    const userQuery = `
      Objective: Generate a weekly schedule for Level ${currentLevel} students.
      Rules:
      1. Each course's total scheduled hours must equal its credit value.
      2. Prefer multiple shorter blocks (1-2 hours). Avoid 3-hour blocks unless necessary.
      3. Spread sessions across different days.
      4. Start/End times between 08:00 and 15:00.
      5. No overlap with occupied slots.
      6. Use valid days: S, M, T, W, H.
      7. Output valid JSON array ONLY. Do not include any text before or after the JSON array.

      Required SE Courses: ${JSON.stringify(requiredCourses.map(c => ({ course_id: c.course_id, name: c.name, credit: c.credit, section_type: 'LECTURE' })))}
      Occupied Slots: ${JSON.stringify(occupiedSlots)}
      Constraints: ${JSON.stringify(rules)}
      User Adjustment: ${user_command}
      
      Output Format: JSON Array of objects: [{ "course_id": number, "day": "S"|"M"|"T"|"W"|"H", "start_time": "HH:MM", "end_time": "HH:MM", "section_type": "LECTURE" }]
      
      **STRICTLY AND ONLY OUTPUT THE JSON ARRAY. DO NOT INCLUDE ANY MARKDOWN TAGS (e.g., \`\`\`json), NO EXPLANATION, AND NO INTRODUCTORY TEXT. START WITH [ AND END WITH ].**
    `;

    // 🛑 تطبيق التحول إلى OpenAI
    const apiKey = process.env.OPENAI_API_KEY; // ⬅️ يستخدم مفتاح OpenAI
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured.' });
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions'; // ⬅️ نقطة نهاية OpenAI

    // 💡 ملاحظة: تم إزالة json_schema الذي تسبب في خطأ "Unknown parameter"
    const payload = {
      model: 'gpt-3.5-turbo-1106', // نموذج سريع وفعال يمكنه إخراج JSON
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userQuery }
      ],
      // 💡 التصحيح: استخدام النوع الأساسي فقط
      response_format: {
        type: "json_object"
      },
      temperature: 0.7
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // طريقة المصادقة لـ OpenAI
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // معالجة استجابة OpenAI
    const message = result?.choices?.[0]?.message || {};
    if (!result.choices || result.choices.length === 0 || !message.content) {
      console.error('AI Response Error:', JSON.stringify(result, null, 2));
      const aiError = result.error?.message || 'AI did not return a valid response. Check OpenAI quota/key.';
      throw new Error(aiError);
    }

    let jsonText = message.content || '';

    try {
      // 💡 التصحيح: تنظيف النص من علامات الـ Markdown والفراغات
      jsonText = jsonText.trim().replace(/```json|```/g, '').trim();

      let generatedSeSchedule = JSON.parse(jsonText);

      // 💡 التصحيح: التأكد من أن generatedSeSchedule هي مصفوفة (Array) لحل مشكلة map is not a function
      if (!Array.isArray(generatedSeSchedule)) {
        generatedSeSchedule = [generatedSeSchedule];
        console.log('✅ AI output wrapped in Array to allow mapping.');
      }

      const correctedSeSchedule = generatedSeSchedule.map(section => ({
        ...section,
        day_code: section.day,
        is_ai_generated: true,
        dept_code: 'SE',
        student_group: currentSchedule.id
      }));

      const finalSchedule = [...fixedSections, ...correctedSeSchedule];
      res.json({ success: true, message: 'Schedule generated by AI.', schedule: finalSchedule });
    } catch (e) {
      console.error('JSON Parsing Error from AI:', e.message, jsonText);
      // الرسالة التي تظهر في الواجهة الأمامية
      throw new Error('AI returned schedule in an unparsable JSON format. Try adjusting the prompt rules.');
    }

  } catch (error) {
    console.error('AI Schedule Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to process AI request.' });
  } finally {
    client.release();
  }
});
*/
// ============================================
// 🔥 AI SCHEDULER ROUTE (Smart Constraints + User Command Priority) 🔥

// ============================================
app.post('/api/schedule/generate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { currentLevel, currentSchedule, seCourses, rules, user_command } = req.body || {};

    if (!currentLevel || !currentSchedule) {
      return res.status(400).json({ error: 'Current level and schedule are required.' });
    }

    // 1. Fetch Required Courses
    let resolvedSeCourses = Array.isArray(seCourses) && seCourses.length > 0 ? seCourses : null;
    if (!resolvedSeCourses) {
      const coursesResult = await client.query(
        `SELECT c.course_id, c.name, c.credit, c.dept_code, c.is_elective
         FROM courses c
         LEFT JOIN approved_electives_by_level aebl ON c.course_id = aebl.course_id
         WHERE (c.level = $1 AND c.dept_code = 'SE') 
            OR (aebl.level = $1)`,
        [currentLevel]
      );
      resolvedSeCourses = coursesResult.rows;
    }

    // 2. Identify Occupied Slots
    const fixedSections = (currentSchedule.sections || []).filter(sec => sec.dept_code !== 'SE');
    const occupiedMap = {};
    fixedSections.forEach((section) => {
      const startHour = parseInt(section.start_time.split(':')[0]);
      const endHour = parseInt(section.end_time.split(':')[0]);
      for (let h = startHour; h < endHour; h++) {
        occupiedMap[`${section.day_code}-${h}`] = true;
      }
    });

    // 3. Calculate FREE Slots (With Rule Filtering)
    const days = ['S', 'M', 'T', 'W', 'H'];
    const hours = [8, 9, 10, 11, 12, 13, 14];
    const freeSlots = [];

    // 🛑 فلترة القواعد المعروفة برمجياً (مثل وقت الغداء)
    // نفترض أن القواعد تأتي كنصوص، نبحث عن كلمات مفتاحية
    const rulesText = (rules || []).join(' ').toLowerCase();
    const avoidLunch = rulesText.includes('12') || rulesText.includes('break') || rulesText.includes('1-12') || rulesText.includes('12-1');

    days.forEach(day => {
      hours.forEach(hour => {
        // إذا كانت القاعدة تقول ممنوع من 12 لـ 1، نحذف الساعة 12 من الخيارات
        if (avoidLunch && hour === 12) return;

        if (!occupiedMap[`${day}-${hour}`]) {
          const timeStr = `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`;
          freeSlots.push({ day, time: timeStr });
        }
      });
    });

    // 4. Prepare Context
    const currentSeSections = (currentSchedule.sections || []).filter(s => s.dept_code === 'SE');
    const currentScheduleText = currentSeSections.map(s =>
      `ID:${s.course_id} (${s.course_name}) -> ${s.day_code} ${s.start_time}-${s.end_time}`
    ).join('\n');

    const requiredCoursesText = resolvedSeCourses
      .map(c => `ID: ${c.course_id} | Name: ${c.name} | TOTAL_HOURS: ${c.credit}`)
      .join('\n');

    // 5. Prompt (Prioritize User Command)
    const systemInstruction = `
    You are a smart university scheduler.
    
    PRIORITY ORDER:
    1. **USER COMMAND:** Execute the user's request FIRST (e.g., "Move Course X to Thursday"). This overrides "Stability".
    2. **RULES:** - Use ONLY the provided "AVAILABLE_SLOTS". 
       - If "AVAILABLE_SLOTS" does not include 12:00-13:00, DO NOT USE IT.
    3. **REQUIRED COURSES:** Schedule ALL courses. Split them if needed to fit into available slots.
    4. **STABILITY:** For courses NOT changed by the user command, try to keep their "CURRENT SCHEDULE" time IF it is valid.
    5. **OUTPUT:** JSON array only.
    `;

    const userQuery = `
    CONTEXT: Level ${currentLevel}
    
    AVAILABLE_SLOTS (These are the ONLY valid times. Do NOT invent others):
    ${JSON.stringify(freeSlots.map(s => `${s.day} ${s.time}`))}

    REQUIRED COURSES:
    ${requiredCoursesText}

    CURRENT SCHEDULE (Reference):
    ${currentScheduleText}

    USER COMMAND (HIGHEST PRIORITY - Apply this change first!): 
    "${user_command || 'Generate optimal schedule'}"

    OUTPUT FORMAT:
    { "schedule": [{ "course_id": <NUMBER>, "day": "S"|"M"|"T"|"W"|"H", "start_time": "HH:MM", "end_time": "HH:MM", "section_type": "LECTURE" }] }
    `;

    // 6. Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-1106',
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userQuery }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    const result = await response.json();
    let jsonText = result.choices?.[0]?.message?.content || '';
    jsonText = jsonText.replace(/```json|```/g, '').trim();
    let generatedData = JSON.parse(jsonText);
    let scheduleArray = generatedData.schedule || generatedData;

    if (!Array.isArray(scheduleArray)) scheduleArray = Object.values(generatedData).find(val => Array.isArray(val)) || [];

    // 7. Safety Net
    const scheduledIds = scheduleArray.map(s => Number(s.course_id));
    const missingCourses = resolvedSeCourses.filter(c => !scheduledIds.includes(c.course_id));

    if (missingCourses.length > 0) {
      // نحاول نجد أي فراغ متاح أولاً
      const fallbackSlot = freeSlots.length > 0 ? freeSlots[0] : { day: "S", time: "08:00-09:00" };
      const forcedSections = missingCourses.map(c => ({
        course_id: c.course_id,
        day: fallbackSlot.day,
        start_time: fallbackSlot.time.split('-')[0],
        end_time: `0${parseInt(fallbackSlot.time.split('-')[0]) + (c.credit || 1)}:00`.slice(-5),
        section_type: "LECTURE", is_forced: true
      }));
      scheduleArray = [...scheduleArray, ...forcedSections];
    }

    // 8. Merge & Return
    const normalizeDay = (d) => ({ 'SUN': 'S', 'MON': 'M', 'TUE': 'T', 'WED': 'W', 'THU': 'H', 'TH': 'H' }[String(d).toUpperCase()] || String(d).toUpperCase());

    const newSections = scheduleArray.map(s => ({
      ...s,
      day_code: normalizeDay(s.day || s.day_code),
      dept_code: 'SE',
      is_ai_generated: true,
      student_group: currentSchedule.id,
      course_id: Number(s.course_id)
    }));

    res.json({ success: true, schedule: [...fixedSections, ...newSections], warning: missingCourses.length > 0 ? "AI missed some courses." : null });

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate schedule. AI Error.' });
  } finally {
    client.release();
  }
});
// ============================================
// RULES & COMMENTS ROUTES
// ============================================
app.get('/api/rules', async (req, res) => {
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

app.post('/api/rules', authenticateToken, async (req, res) => {
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

app.delete('/api/rules/:ruleId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { ruleId } = req.params;
    const query = 'DELETE FROM rules WHERE rule_id = $1';
    await client.query(query, [ruleId]);
    res.json({ success: true, message: 'Rule deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rule.' });
  } finally {
    client.release();
  }
});

app.post('/api/comments', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id, schedule_version_id, comment } = req.body;
    const insertQuery = `INSERT INTO comments (student_id, schedule_version_id, comment) VALUES ($1, $2, $3) RETURNING *;`;
    const result = await client.query(insertQuery, [student_id, schedule_version_id, comment]);
    res.status(201).json({ success: true, message: 'Comment added successfully.', comment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment. Check server logs for details.' });
  } finally {
    client.release();
  }
});

app.get('/api/comments/all', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
          SELECT c.id as comment_id, c.comment, c.created_at, s.student_id, s.level as student_level, u.name as student_name, sv.id as schedule_version_id, sv.version_comment
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

app.get('/api/comments/:schedule_version_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { schedule_version_id } = req.params;
    const query = `
      SELECT c.id, c.comment, c.created_at, u.name AS student_name
      FROM comments c
      JOIN students s ON c.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE c.schedule_version_id = $1 AND c.user_id IS NULL 
      ORDER BY c.created_at DESC
    `;
    const result = await client.query(query, [schedule_version_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments.' });
  } finally {
    client.release();
  }
});

// Faculty Comments
app.get('/api/schedule-versions/approved', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level } = req.query || {};
    let sql = 'SELECT * FROM schedule_versions WHERE committee_approved = true';
    const params = [];
    if (level) { params.push(level); sql += ' AND level = $1'; }
    sql += ' ORDER BY created_at DESC';
    const result = await client.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch approved schedule versions.' });
  } finally {
    client.release();
  }
});

app.get('/api/schedule-versions/:id/faculty-comments', authenticateToken, requireCommitteeRole, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const sql = `SELECT c.id, c.comment, c.created_at, u.user_id, u.name AS faculty_name, u.email AS faculty_email FROM comments c JOIN users u ON c.user_id = u.user_id WHERE c.schedule_version_id = $1 AND c.user_id IS NOT NULL ORDER BY c.created_at DESC`;
    const result = await client.query(sql, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch faculty comments.' });
  } finally {
    client.release();
  }
});

app.post('/api/schedule-versions/:id/faculty-comments', authenticateToken, requireFaculty, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { comment } = req.body || {};
    if (!comment || !String(comment).trim()) return res.status(400).json({ message: 'Comment is required.' });
    const userId = req.user?.id;
    const insert = `INSERT INTO comments (schedule_version_id, user_id, comment) VALUES ($1, $2, $3) RETURNING id, schedule_version_id, user_id, comment, created_at`;
    const result = await client.query(insert, [id, userId, String(comment).trim()]);
    res.status(201).json({ success: true, comment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create faculty comment.' });
  } finally {
    client.release();
  }
});

app.get('/api/schedule-versions/:id/my-faculty-comments', authenticateToken, requireFaculty, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const sql = `SELECT c.id, c.comment, c.created_at FROM comments c WHERE c.schedule_version_id = $1 AND c.user_id = $2 ORDER BY c.created_at DESC`;
    const result = await client.query(sql, [id, userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch my faculty comments.' });
  } finally {
    client.release();
  }
});

// Utils
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK-V2', timestamp: new Date().toISOString() });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

server.listen(PORT, () => {
  console.log(`dYs? SmartSchedule Server running on port ${PORT}`);
  console.log(`dY"S Connected to PostgreSQL database: ${process.env.DB_NAME}`);
  console.log(`[collaboration] WebSocket namespace ready at ws://localhost:${PORT}/${COLLAB_NAMESPACE}/:roomId`);
});

let shuttingDown = false;
const gracefulShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('dY>` Shutting down server (HTTP + collaboration WS)...');
  wss.clients.forEach((client) => {
    try { client.terminate(); } catch { }
  });
  wss.close(() => console.log('[collaboration] websocket server closed'));
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

