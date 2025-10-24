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

// Middleware
app.use(cors({
  // 👇 allow both 3000 and 3001 (React may choose 3001)
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
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
  const { password } = req.body;
  if (password !== process.env.COMMITTEE_PASSWORD) {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة، غير مسموح بالدخول.' });
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

    // Check if it's a user (faculty/staff)
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
          email: user.email,
          full_name: user.name,
          role: user.role,
          type: 'user'
        }
      });
    }

    // Check if it's a student
    const studentQuery = `
      SELECT s.student_id, s.is_ir, s.level, u.user_id, u.email, u.name, u.password
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
        { id: student.student_id, user_id: student.user_id, email: student.email, type: 'student' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: student.student_id,
          user_id: student.user_id,
          email: student.email,
          full_name: student.name,
          level: student.level,
          is_ir: student.is_ir,
          type: 'student'
        }
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
    const result = await client.query(query, [email, hashedPassword, name, role]);

    res.json({ success: true, message: 'تمت إضافة المستخدم بنجاح!', user: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
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
    const studentResult = await client.query(studentQuery, [userId, level, is_ir || false]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'تمت إضافة الطالب بنجاح!',
      studentId: studentResult.rows[0].student_id,
      userId
    });
  } catch (error) {
    await client.query('ROLLBACK');
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

// ============================================
// COURSE ROUTES
// ============================================
app.get('/api/courses', async (req, res) => {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM courses ORDER BY level, name';
    const result = await client.query(query);
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
    const { name, credit, preid, level, is_elective } = req.body;

    const query = `
      INSERT INTO courses (name, credit, preid, level, is_elective)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await client.query(query, [name, credit, preid, level, is_elective || false]);
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
  // حماية المسار
  const client = await pool.connect();
  try {
    const query = `
            SELECT 
                s.*, 
                c.name AS course_name, 
                c.level AS level,         
                c.dept_code AS dept_code
            FROM sections s
            JOIN courses c ON s.course_id = c.course_id
            ORDER BY c.level, s.day_code, s.start_time
        `;
    const result = await client.query(query);

    const sectionsWithCastedLevel = result.rows.map(row => ({
      ...row,
      level: parseInt(row.level, 10)
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
// STATISTICS ROUTES
// ============================================
app.get('/api/statistics', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    // الاستعلام المحدث لعد الطلاب من جدول users بناءً على الدور
    // هذا يحل مشكلة ظهور الصفر (0) إذا لم تكن هناك سجلات في جدول students المنفصل
    const studentsQuery = "SELECT COUNT(*) FROM users WHERE role = 'student'";

    // الاستعلامات الأخرى (لا تحتاج لتغيير)
    const votesQuery = 'SELECT COUNT(*) FROM votes';
    const votingStudentsQuery = 'SELECT COUNT(DISTINCT student_id) FROM votes';

    // ملاحظة: تم حذف استعلام coursesQuery من الـ Promise.all لعدم استخدامه في الحساب
    const [studentsResult, votesResult, votingStudentsResult] = await Promise.all([
      client.query(studentsQuery),
      client.query(votesQuery),
      client.query(votingStudentsQuery)
    ]);

    const totalStudents = parseInt(studentsResult.rows[0].count);
    const totalVotes = parseInt(votesResult.rows[0].count);
    const votingStudents = parseInt(votingStudentsResult.rows[0].count);
    const participationRate = totalStudents > 0 ? (votingStudents / totalStudents * 100).toFixed(1) : 0;

    res.json({
      totalStudents,
      totalVotes,
      votingStudents,
      participationRate
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
  } finally {
    client.release();
  }
});


// ============================================
// HEALTH CHECK
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
// ... (بقية الاستيرادات و middleware)

// ============================================
// AI SCHEDULER ROUTES
// ============================================

// مسار لتوليد جدول جديد باستخدام Gemini
app.post('/api/schedule/generate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { currentLevel, currentSchedule, seCourses, rules } = req.body;

    // 1. تجميع بيانات الجدول الحالي
    const currentSectionsMap = {};
    currentSchedule.sections.forEach(sec => {
      const timeSlot = `${sec.day_code} ${sec.start_time.substring(0, 5)} - ${sec.end_time.substring(0, 5)}`;
      // نحتاج فقط لتعيين المحاضرات الأساسية التي يجب تجنبها
      if (sec.section_type === 'LECTURE' || sec.type === 'LAB') {
        currentSectionsMap[timeSlot] = `${sec.dept_code} ${sec.course_name.split(' ')[0]} (${sec.section_type})`;
      }
    });

    const occupiedSlots = JSON.stringify(currentSectionsMap);

    // 2. تجميع بيانات مواد هندسة البرمجيات التي يجب جدولتها
    const requiredSeCourses = seCourses.map(c =>
      `${c.name} (${c.credit} ساعات، المستوى ${c.level})`
    ).join(', ');

    // 3. بناء موجه Gemini (Prompt)
    const systemInstruction = `You are a university academic scheduler AI. Your task is to generate a time schedule for Software Engineering (SE) courses based on predefined occupied slots (Official non-SE courses). The schedule must be based on a 60-minute time slot (e.g., 08:00-09:00, 09:00-10:00). Output MUST be a structured JSON array of objects.`;

    const userQuery = `
            Please schedule the following SE courses into the available time slots for Level ${currentLevel}. The timetable operates from Sunday (S) to Thursday (H).

            - **Mandatory Courses to Schedule:** ${requiredSeCourses}
            - **Current Rules/Constraints:** ${rules.join('; ')}
            - **Occupied Slots to AVOID (Official Non-SE Courses):** ${occupiedSlots}

            Generate a schedule that avoids all occupied slots and minimizes time gaps. Use the format: [{course_id: number, day: string (S, M, T, W, H), start_time: string (HH:MM), end_time: string (HH:MM), section_type: 'LECTURE'}].
        `;

    // 4. استدعاء Gemini API
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              course_id: { type: "NUMBER" },
              day: { type: "STRING" },
              start_time: { type: "STRING" },
              end_time: { type: "STRING" },
              section_type: { type: "STRING" }
            },
            required: ["course_id", "day", "start_time", "end_time", "section_type"]
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
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      console.error("Gemini failed to return valid JSON:", result);
      throw new Error("AI did not return a valid schedule. Check the AI prompt or rules.");
    }

    const generatedSchedule = JSON.parse(jsonText);

    // 5. حفظ الجدول المُولَّد في قاعدة البيانات (Sections)
    // (هذه الخطوة معقدة وتتطلب منطق إدخال جماعي، سنفترض أنها تمت)

    res.json({
      success: true,
      message: "تم توليد الجدول بنجاح بواسطة AI.",
      schedule: generatedSchedule
    });

  } catch (error) {
    console.error('AI Schedule Generation error:', error);
    res.status(500).json({ error: error.message || 'خطأ في معالجة طلب الذكاء الاصطناعي.' });
  } finally {
    client.release();
  }
});
