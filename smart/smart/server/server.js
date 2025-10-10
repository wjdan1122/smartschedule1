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

// Login endpoint - handles both users and students
app.post('/api/auth/login', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // ✅ FIRST: Check if it's a student
    const studentQuery = `
      SELECT s.student_id, s.is_ir, s.level, u.user_id, u.email, u.name, u.password, u.role
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      WHERE u.email = $1
    `;
    const studentResult = await client.query(studentQuery, [email]);
    
    if (studentResult.rows.length > 0) {
      const student = studentResult.rows[0];
      const isValidPassword = await bcrypt.compare(password, student.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      }
      const token = jwt.sign(
        {
          id: student.student_id,
          user_id: student.user_id,
          email: student.email,
          type: 'student',
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({
        token,
        user: {
          id: student.student_id,
          user_id: student.user_id,
          email: student.email,
          name: student.name,
          level: student.level,
          is_ir: student.is_ir,
          role: 'student',
          type: 'student',
        },
      });
    }

    // ✅ SECOND: If not a student, check if it's a regular user (faculty/staff)
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await client.query(userQuery, [email]);
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
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
          user_id: user.user_id,
          email: user.email,
          name: user.name,
          role: user.role,
          type: 'user',
        },
      });
    }

    // No user or student found
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطأ في الخادم' });
  } finally {
    client.release();
  }
});

// Register new user (faculty/staff)
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

// Register new student
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

// ✅ Get single student by user_id - NEW ENDPOINT
app.get('/api/student/:user_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_id } = req.params;
    console.log('Fetching student for user_id:', user_id);
    
    const query = `
      SELECT 
        s.student_id, 
        s.is_ir, 
        s.level, 
        u.user_id,
        u.email, 
        u.name,
        0 as total_courses
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      WHERE u.user_id = $1
    `;
    const result = await client.query(query, [user_id]);
    
    console.log('Student query result:', result.rows);
    
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

// Get all students
app.get('/api/students', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'خطأ في جلب الطلاب' });
  } finally {
    client.release();
  }
});

// Update student level
app.put('/api/students/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { level } = req.body;

    if (!level) {
      return res.status(400).json({ error: 'Level is required for update.' });
    }

    const query = `
      UPDATE students SET level = $1 
      WHERE student_id = $2 
      RETURNING student_id, level
    `;

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

// Delete student
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
// VOTING ROUTES
// ============================================
app.post('/api/vote', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id, course_id, vote_value } = req.body;
    const checkQuery = 'SELECT * FROM votes WHERE student_id = $1 AND course_id = $2';
    const checkResult = await client.query(checkQuery, [student_id, course_id]);
    if (checkResult.rows.length > 0) {
      const updateQuery = `
        UPDATE votes
        SET vote_value = $1, voted_at = CURRENT_TIMESTAMP
        WHERE student_id = $2 AND course_id = $3
        RETURNING *
      `;
      await client.query(updateQuery, [vote_value, student_id, course_id]);
    } else {
      const insertQuery = `
        INSERT INTO votes (student_id, course_id, vote_value)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      await client.query(insertQuery, [student_id, course_id, vote_value]);
    }
    res.json({ success: true, message: 'تم تسجيل الصوت بنجاح!' });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'خطأ في تسجيل الصوت' });
  } finally {
    client.release();
  }
});

app.get('/api/votes/course/:course_id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { course_id } = req.params;
    const query = 'SELECT * FROM votes WHERE course_id = $1';
    const result = await client.query(query, [course_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: 'خطأ في جلب الأصوات' });
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
// STATISTICS ROUTES
// ============================================
app.get('/api/statistics', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const studentsQuery = "SELECT COUNT(*) FROM users WHERE role = 'student'";
    const votesQuery = 'SELECT COUNT(*) FROM votes';
    const votingStudentsQuery = 'SELECT COUNT(DISTINCT student_id) FROM votes';
    const [studentsResult, votesResult, votingStudentsResult] = await Promise.all([
      client.query(studentsQuery),
      client.query(votesQuery),
      client.query(votingStudentsQuery),
    ]);
    const totalStudents = parseInt(studentsResult.rows[0].count, 10);
    const totalVotes = parseInt(votesResult.rows[0].count, 10);
    const votingStudents = parseInt(votingStudentsResult.rows[0].count, 10);
    const participationRate =
      totalStudents > 0 ? (votingStudents / totalStudents) * 100 : 0;
    res.json({
      totalStudents,
      totalVotes,
      votingStudents,
      participationRate: Number(participationRate).toFixed(1),
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
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

    const seCoursesResult = await client.query(
      'SELECT course_id, name, credit FROM courses WHERE level = $1 AND dept_code = $2',
      [currentLevel, 'SE']
    );
    const requiredSeCourses = seCoursesResult.rows;

    if (requiredSeCourses.length === 0) {
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
${JSON.stringify(requiredSeCourses.map(c => ({
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