console.log("✅✅✅ RUNNING THE LATEST SERVER.JS FILE ✅✅✅");
// smart3/smart/server/server.js
console.log("👉 Running THIS server.js from smart3/smart/server");

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
// 👇 run backend on 5000 (not 3000)
const PORT = process.env.PORT || 5000;
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));


// Middleware
app.use(
  cors({
    // 👇 allow both 3000 and 3001 (React may choose 3001)
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL database:', err.stack);
  } else {
    console.log('✅ Successfully connected to PostgreSQL database');
    release();
  }
});

// Middleware to verify JWT token
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

// Middleware to verify committee access
const verifyCommittee = (req, res, next) => {
  const { password, committeePassword } = req.body || {};
  const pwd = committeePassword || password;
  // Accept either
  if (pwd !== process.env.COMMITTEE_PASSWORD) {
    return res
      .status(401)
      .json({ error: 'كلمة المرور غير صحيحة، غير مسموح بالدخول.' });
  }
  next();
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // First: Get user + possible student info
    const query = `
            SELECT 
                u.user_id, u.name, u.email, u.password, u.role,
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

    // ============================
    // ✅ For Student Users
    // ============================
    if (user.role === 'student') {
      let studentId = user.student_id;
      let level = user.level;
      let is_ir = user.is_ir;

      // If student_id wasn't found in the join (maybe student not in table yet)
      if (!studentId) {
        const studentResult = await client.query(
          'SELECT student_id, level, is_ir FROM students WHERE user_id = $1',
          [user.user_id]
        );

        if (studentResult.rowCount === 0) {
          return res.status(403).json({ error: 'User has student role but no student record exists.' });
        }

        const student = studentResult.rows[0];
        studentId = student.student_id;
        level = student.level;
        is_ir = student.is_ir;
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
          level: level,
          is_ir: is_ir,
          type: 'student',
          role: 'student'
        },
      });
    }

    // ============================
    // ✅ For Non-Student Users
    // ============================
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

// ✅ Register new user (faculty/staff) - RESTORED
app.post('/api/auth/register-user', verifyCommittee, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, name, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (email, password, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, email, name, role
    `;
    const result = await client.query(query, [
      email,
      hashedPassword,
      name,
      role,
    ]);
    res.json({ success: true, message: 'تمت إضافة المستخدم بنجاح!', user: result.rows[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    } else {
      res.status(500).json({ error: 'خطأ في إضافة المستخدم' });
    }
  } finally {
    client.release();
  }
});

// ✅ Register new student - RESTORED
app.post('/api/auth/register-student', verifyCommittee, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { email, password, name, level, is_ir } = req.body;
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
    const studentResult = await client.query(studentQuery, [
      userId,
      level,
      is_ir || false,
    ]);
    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'تمت إضافة الطالب بنجاح!',
      studentId: studentResult.rows[0].student_id,
      userId,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error creating student:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    } else {
      res.status(500).json({ error: 'خطأ في إضافة الطالب' });
    }
  } finally {
    client.release();
  }
});

// ============================================
// STUDENT ROUTES
// ============================================

// Get the active schedule for a specific level (for StudentDashboard)
app.get('/api/schedules/level/:level', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  console.log(`--- [ DIAGNOSTIC ] --- Hit route for level: ${req.params.level}`);
  try {
    const { level } = req.params;

    const scheduleQuery = 'SELECT * FROM schedule_versions WHERE level = $1 AND is_active = true LIMIT 1';
    const scheduleResult = await client.query(scheduleQuery, [level]);

    if (scheduleResult.rows.length === 0) {
      console.log(`--- [ DIAGNOSTIC ] --- No active schedule found for level ${level}.`);
      return res.status(404).json({ message: `No active schedule found for level ${level}.` });
    }

    const activeSchedule = scheduleResult.rows[0];

    console.log('--- [ DIAGNOSTIC ] --- Found schedule. Data BEFORE sending:');
    console.log(activeSchedule);

    res.json({
      schedule: activeSchedule,
      comments: []
    });

  } catch (error) {
    console.error('--- [ DIAGNOSTIC ] --- CRASH DETECTED IN ROUTE:');
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch schedule data due to a server crash.' });
  } finally {
    client.release();
  }
});

// Get a single student's full details (can be used in profiles)
app.get('/api/student/:user_id', authenticateToken, async (req, res) => {
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

// Get all students (for ManageStudents page)
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

// Update a student's level
app.put('/api/students/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { level } = req.body;
    if (!level) {
      return res.status(400).json({ error: 'Level is required for update.' });
    }
    const query = `UPDATE students SET level = $1 WHERE student_id = $2 RETURNING student_id, level`;
    const result = await client.query(query, [level, id]);
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

// Delete a student
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

// ✅ رفع المستوى لمرة واحدة فقط
app.put('/api/student/level-up/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // التحقق من المستوى الحالي
    const studentRes = await client.query(
      'SELECT level, has_leveled_up FROM students WHERE student_id=$1',
      [id]
    );

    if (studentRes.rows.length === 0)
      return res.status(404).json({ error: 'Student not found' });

    const student = studentRes.rows[0];

    // التحقق إذا سبق رفع المستوى من قبل
    if (student.has_leveled_up) {
      return res.status(400).json({ error: 'Level already increased once' });
    }

    // رفع المستوى وتحديث حالة has_leveled_up
    const newLevel = student.level + 1;
    await client.query(
      'UPDATE students SET level=$1, has_leveled_up=true WHERE student_id=$2',
      [newLevel, id]
    );

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
    res.status(500).json({ error: 'خطأ في جلب المقررات' });
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
    res.status(500).json({ error: 'خطأ في جلب المقررات الاختيارية' });
  } finally {
    client.release();
  }
});

app.post('/api/courses', verifyCommittee, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, credit, level, is_elective, dept_code } = req.body;
    const query = `
      INSERT INTO courses (name, credit, level, is_elective, dept_code)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await client.query(query, [
      name,
      credit,
      level,
      is_elective || false,
      dept_code,
    ]);
    res.json({ success: true, message: 'تمت إضافة المقرر بنجاح!', course: result.rows[0] });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'خطأ في إضافة المقرر' });
  } finally {
    client.release();
  }
});

// ============================================
// VOTING & APPROVAL ROUTES
// ============================================

// Allows a student to cast or update a vote
app.post('/api/vote', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id, course_id, vote_value } = req.body;
    // Using ON CONFLICT for an efficient upsert
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

// --- NEW: Check a student's existing votes ---
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
            SELECT
                c.course_id,
                c.name,
                c.is_approved,
                s.level AS student_level,
                COUNT(v.vote_id) AS vote_count
            FROM
                courses c
            LEFT JOIN
                votes v ON c.course_id = v.course_id
            LEFT JOIN
                students s ON v.student_id = s.student_id
            WHERE
                c.is_elective = true
            GROUP BY
                c.course_id, c.name, c.is_approved, s.level
            ORDER BY
                c.course_id, s.level;
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

// --- Approve an elective course FOR A SPECIFIC LEVEL ---
app.get('/api/electives/approved', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT course_id, level
      FROM approved_electives_by_level
      ORDER BY level, course_id
    `;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approved electives by level:', error);
    res.status(500).json({ error: 'Failed to fetch approved electives.' });
  } finally {
    client.release();
  }
});

app.post('/api/electives/approve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { course_id, level } = req.body;
    if (!course_id || !level) {
      return res.status(400).json({ error: 'Course ID and Level are required.' });
    }

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
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error approving course for level:', error);
    res.status(500).json({ error: 'Failed to approve course.' });
  } finally {
    client.release();
  }
});

app.delete('/api/electives/approve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { course_id, level } = req.body;
    if (!course_id || !level) {
      return res.status(400).json({ error: 'Course ID and Level are required.' });
    }

    await client.query('BEGIN');

    const deleteResult = await client.query(
      'DELETE FROM approved_electives_by_level WHERE course_id = $1 AND level = $2 RETURNING *',
      [course_id, level]
    );

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approved course record not found for the specified level.' });
    }

    const remaining = await client.query(
      'SELECT 1 FROM approved_electives_by_level WHERE course_id = $1 LIMIT 1',
      [course_id]
    );
    if (remaining.rows.length === 0) {
      await client.query('UPDATE courses SET is_approved = false WHERE course_id = $1', [course_id]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Course ${course_id} removed from Level ${level}.` });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error removing approved course level:', error);
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
    res.status(500).json({ error: 'خطأ في جلب الجداول' });
  } finally {
    client.release();
  }
});

app.post('/api/schedules', verifyCommittee, async (req, res) => {
  const client = await pool.connect();
  try {
    const { group_number, level } = req.body;
    const query = `
      INSERT INTO schedules (group_number, level)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await client.query(query, [group_number, level]);
    res.json({ success: true, message: 'تمت إضافة الجدول بنجاح!', schedule: result.rows[0] });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'خطأ في إضافة الجدول' });
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
    console.error('Error fetching sections with course info:', error);
    res.status(500).json({ error: 'خطأ في جلب الشعب مع معلومات المقرر' });
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
    if (!level) {
      return res.status(400).json({ message: 'Level query parameter is required.' });
    }
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
    if (!level || !sections) {
      return res.status(400).json({ message: 'Level and sections are required.' });
    }
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

app.patch('/api/schedule-versions/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { version_comment } = req.body;

    if (!version_comment || !version_comment.trim()) {
      return res.status(400).json({ message: 'Version name is required.' });
    }

    const query = `
      UPDATE schedule_versions
      SET version_comment = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await client.query(query, [version_comment.trim(), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Schedule version not found.' });
    }

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
    if (levelResult.rows.length === 0) {
      throw new Error('Version not found.');
    }
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
// STATISTICS ROUTES (Updated)
// ============================================
app.get('/api/statistics', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const studentsQuery = "SELECT COUNT(*) FROM users WHERE role = 'student'";
    const votesQuery = 'SELECT COUNT(*) FROM votes';
    const votingStudentsQuery = 'SELECT COUNT(DISTINCT student_id) FROM votes';
    const commentsQuery = 'SELECT COUNT(*) FROM comments';

    const [studentsResult, votesResult, votingStudentsResult, commentsResult] = await Promise.all([
      client.query(studentsQuery),
      client.query(votesQuery),
      client.query(votingStudentsQuery),
      client.query(commentsQuery),
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

// ============================================
// AI SCHEDULER ROUTE
// ============================================
app.post('/api/schedule/generate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { level, currentLevel, currentSchedule, user_command } = req.body;
    const scheduleLevel = level || currentLevel;

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
      return res.status(404).json({
        error: `No Software Engineering courses found for level ${currentLevel}.`
      });
    }

    const fixedSections = currentSchedule.sections.filter(sec => sec.dept_code !== 'SE');
    const occupiedSlots = fixedSections.map(sec =>
      `${sec.day_code} from ${sec.start_time.substring(0, 5)} to ${sec.end_time.substring(0, 5)} for ${sec.dept_code}`
    );

    const finalCommand = user_command ||
      `Please schedule the provided SE courses optimally, avoiding all occupied slots and following all rules.`;

    const randomSeed = Math.random();

    const systemInstruction = `
You are a university academic scheduler AI.
Your task is to schedule the provided list of Software Engineering (SE) courses into available slots,
following all rules strictly.
You MUST treat the 'occupied slots' list as fixed and unmovable.
`;

    const userQuery = `
You are a university academic scheduler AI.

🎯 **Objective:** Generate a weekly schedule for the Software Engineering (SE) courses for Level ${currentLevel} students.
Each SE course must be scheduled according to its total credit hours, distributed across the available weekly time slots.

📘 **Course Scheduling Rules:**
1. Each course's total scheduled hours must exactly equal its credit value.
2. Split the credit hours intelligently across the week:
   - Prefer multiple shorter blocks (1-hour or 2-hour sessions) rather than long continuous sessions.
   - Avoid any 3-hour continuous sessions unless there is absolutely no alternative.
3. Spread sessions across different days when possible (e.g., a 3-credit course could meet M/W/Th or S/T/W).
4. Maintain realistic start and end times (08:00 to 15:00).
5. No overlap between SE course sessions and the "occupied slots" listed below.
6. Try to minimize idle gaps within the same day.
7. Use only valid days: S, M, T, W, H.
8. Each session must have "section_type": "LECTURE".

💡 **Scheduling Philosophy:**
Think like a human academic scheduler:
- Maintain balance between mornings and afternoons.
- Avoid scheduling the same course twice in the same day (unless it's a 2-hour block).
- Distribute sessions fairly among available time slots.

🧩 **Required SE Courses (with credit hours):**
${JSON.stringify(requiredCourses.map(c => ({
      course_id: c.course_id,
      name: c.name,
      credit: c.credit,
      section_type: 'LECTURE'
    })), null, 2)}

🚫 **Occupied Slots (Non-SE official courses):**
${JSON.stringify(occupiedSlots, null, 2)}

🧠 **Active Scheduling Constraints (Rules):**
${JSON.stringify(rules, null, 2)}

🔄 **Variation Seed:** ${randomSeed}

✅ **Output Format (JSON ONLY):**
Return a valid JSON array of objects, each representing one SE course block:
[
  {
    "course_id": number,
    "day": "S" | "M" | "T" | "W" | "H",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "section_type": "LECTURE"
  }
]
Return only this JSON array, with no explanation text.
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              course_id: { type: 'NUMBER' },
              day: { type: 'STRING' },
              start_time: { type: 'STRING' },
              end_time: { type: 'STRING' },
              section_type: { type: 'STRING' }
            },
            required: ['course_id', 'day', 'start_time', 'end_time', 'section_type']
          }
        }
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      console.error('AI Response Debug:', JSON.stringify(result, null, 2));
      throw new Error('AI did not return a valid schedule. Please check the server logs.');
    }

    const generatedSeSchedule = JSON.parse(jsonText);

    const correctedSeSchedule = generatedSeSchedule.map(section => ({
      ...section,
      day_code: section.day,
      is_ai_generated: true,
      dept_code: 'SE',
      student_group: currentSchedule.id
    }));

    const finalSchedule = [...fixedSections, ...correctedSeSchedule];

    res.json({
      success: true,
      message: 'Schedule generated by AI.',
      schedule: finalSchedule
    });

  } catch (error) {
    console.error('AI Schedule Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to process AI request.' });
  } finally {
    client.release();
  }
});

// ============================================
// RULES ROUTES
// ============================================
app.get('/api/rules', async (req, res) => {
  const client = await pool.connect();
  try {
    const query = 'SELECT rule_id, text FROM rules ORDER BY rule_id';
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules.' });
  } finally {
    client.release();
  }
});

app.post('/api/rules', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Rule text is required.' });
    const query = 'INSERT INTO rules (text) VALUES ($1) RETURNING *';
    const result = await client.query(query, [text]);
    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error adding rule:', error);
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
    console.error('Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete rule.' });
  } finally {
    client.release();
  }
});

app.delete('/api/schedule-versions/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const versionResult = await client.query('SELECT is_active FROM schedule_versions WHERE id = $1', [id]);

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Schedule version not found.' });
    }

    if (versionResult.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot delete an active version. Activate another version first.' });
    }

    await client.query('DELETE FROM schedule_versions WHERE id = $1', [id]);
    res.json({ success: true, message: 'Schedule version deleted.' });
  } catch (error) {
    console.error('Error deleting schedule version:', error);
    res.status(500).json({ message: 'Failed to delete schedule version.' });
  } finally {
    client.release();
  }
});

// ============================================
// COMMENTS ROUTES (Correctly Ordered)
// ============================================

// --- This route handles POSTing a new comment ---
app.post('/api/comments', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id, schedule_version_id, comment } = req.body;
    if (!student_id || !schedule_version_id || !comment) {
      return res.status(400).json({ error: 'student_id, schedule_version_id, and comment are required.' });
    }
    const insertQuery = `INSERT INTO comments (student_id, schedule_version_id, comment) VALUES ($1, $2, $3) RETURNING *;`;
    const result = await client.query(insertQuery, [student_id, schedule_version_id, comment]);
    res.status(201).json({ success: true, message: 'Comment added successfully.', comment: result.rows[0] });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment. Check server logs for details.' });
  } finally {
    client.release();
  }
});

// --- This route gets ALL comments for the admin dashboard ---
app.get('/api/comments/all', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
            SELECT 
                c.id as comment_id, 
                c.comment, 
                c.created_at,
                s.student_id,
                s.level as student_level,
                u.name as student_name,
                sv.id as schedule_version_id,
                sv.version_comment
            FROM comments c
            LEFT JOIN students s ON c.student_id = s.student_id
            LEFT JOIN users u ON s.user_id = u.user_id
            LEFT JOIN schedule_versions sv ON c.schedule_version_id = sv.id
            ORDER BY c.created_at DESC;
        `;
    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all comments:', error);
    res.status(500).json({ error: 'Failed to fetch all comments.' });
  } finally {
    client.release();
  }
});

// --- This route gets comments for a SPECIFIC schedule version ---
app.get('/api/comments/:schedule_version_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { schedule_version_id } = req.params;
    const query = `
      SELECT c.id, c.comment, c.created_at, u.name AS student_name
      FROM comments c
      JOIN students s ON c.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE c.schedule_version_id = $1
      ORDER BY c.created_at DESC
    `;
    const result = await client.query(query, [schedule_version_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments for schedule:', error);
    res.status(500).json({ error: 'Failed to fetch comments.' });
  } finally {
    client.release();
  }
});

// ============================================
// HEALTH CHECK & FINAL MIDDLEWARE
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SmartSchedule Server running on port ${PORT}`);
  console.log(`📊 Connected to PostgreSQL database: ${process.env.DB_NAME}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
