// server/middleware/validation.js
// ========================================
// VALIDATION MIDDLEWARE FOR API ROUTES
// ========================================

const {
    validateKSUEmail,
    validatePassword,
    validateName,
    validateLevel,
    validateRole,
    sanitizeText,
    validateId,
    validateCommitteePassword,
    validateCredit
} = require('../utils/validators');

/**
 * Validates user registration (staff)
 */
const validateUserRegistration = (req, res, next) => {
    const { email, password, name, role, committeePassword } = req.body;

    // 1. Validate committee password
    const committeeCheck = validateCommitteePassword(committeePassword);
    if (!committeeCheck.isValid) {
        return res.status(401).json({ error: committeeCheck.error });
    }

    // 2. Validate email
    const emailCheck = validateKSUEmail(email);
    if (!emailCheck.isValid) {
        return res.status(400).json({ error: emailCheck.error });
    }

    // 3. Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
        return res.status(400).json({ error: passwordCheck.error });
    }

    // 4. Validate name
    const nameCheck = validateName(name);
    if (!nameCheck.isValid) {
        return res.status(400).json({ error: nameCheck.error });
    }

    // 5. Validate role
    const roleCheck = validateRole(role, emailCheck.type);
    if (!roleCheck.isValid) {
        return res.status(400).json({ error: roleCheck.error });
    }

    // Attach sanitized/validated data to request
    req.validatedData = {
        email: emailCheck.email,
        password: password,
        name: nameCheck.sanitized,
        role: roleCheck.sanitized,
        type: emailCheck.type
    };

    next();
};

/**
 * Validates student registration
 */
const validateStudentRegistration = (req, res, next) => {
    const { email, password, name, level, is_ir, committeePassword } = req.body;

    // 1. Validate committee password
    const committeeCheck = validateCommitteePassword(committeePassword);
    if (!committeeCheck.isValid) {
        return res.status(401).json({ error: committeeCheck.error });
    }

    // 2. Validate email (must be student email)
    const emailCheck = validateKSUEmail(email);
    if (!emailCheck.isValid) {
        return res.status(400).json({ error: emailCheck.error });
    }

    if (emailCheck.type !== 'student') {
        return res.status(400).json({
            error: 'Student registration requires a student email (9 digits@student.ksu.edu.sa)'
        });
    }

    // 3. Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
        return res.status(400).json({ error: passwordCheck.error });
    }

    // 4. Validate name
    const nameCheck = validateName(name);
    if (!nameCheck.isValid) {
        return res.status(400).json({ error: nameCheck.error });
    }

    // 5. Validate level
    const levelCheck = validateLevel(level);
    if (!levelCheck.isValid) {
        return res.status(400).json({ error: levelCheck.error });
    }

    // Attach sanitized/validated data to request
    req.validatedData = {
        email: emailCheck.email,
        password: password,
        name: nameCheck.sanitized,
        level: levelCheck.level,
        is_ir: Boolean(is_ir),
        role: 'student'
    };

    next();
};

/**
 * Validates login credentials
 */
const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    // 1. Validate email
    const emailCheck = validateKSUEmail(email);
    if (!emailCheck.isValid) {
        return res.status(400).json({ error: emailCheck.error });
    }

    // 2. Basic password check (detailed check happens during login)
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Attach validated email to request
    req.validatedData = {
        email: emailCheck.email,
        password: password
    };

    next();
};

/**
 * Validates student update (level change)
 */
const validateStudentUpdate = (req, res, next) => {
    const { id } = req.params;
    const { level } = req.body;

    // 1. Validate student ID
    const idCheck = validateId(id, 'Student ID');
    if (!idCheck.isValid) {
        return res.status(400).json({ error: idCheck.error });
    }

    // 2. Validate level
    const levelCheck = validateLevel(level);
    if (!levelCheck.isValid) {
        return res.status(400).json({ error: levelCheck.error });
    }

    req.validatedData = {
        studentId: idCheck.id,
        level: levelCheck.level
    };

    next();
};

/**
 * Validates course creation
 */
const validateCourseCreation = (req, res, next) => {
    const { name, credit, level, is_elective, dept_code, committeePassword } = req.body;

    // 1. Validate committee password
    const committeeCheck = validateCommitteePassword(committeePassword);
    if (!committeeCheck.isValid) {
        return res.status(401).json({ error: committeeCheck.error });
    }

    // 2. Validate course name
    const nameCheck = sanitizeText(name, 200);
    if (!nameCheck.isValid) {
        return res.status(400).json({ error: 'Course name: ' + nameCheck.error });
    }

    // 3. Validate credit hours
    const creditCheck = validateCredit(credit);
    if (!creditCheck.isValid) {
        return res.status(400).json({ error: creditCheck.error });
    }

    // 4. Validate level
    const levelCheck = validateLevel(level);
    if (!levelCheck.isValid) {
        return res.status(400).json({ error: creditCheck.error });
    }

    // 5. Validate department code
    if (!dept_code || typeof dept_code !== 'string') {
        return res.status(400).json({ error: 'Department code is required' });
    }

    const deptPattern = /^[A-Z]{2,4}$/;
    if (!deptPattern.test(dept_code.toUpperCase())) {
        return res.status(400).json({
            error: 'Department code must be 2-4 uppercase letters (e.g., SE, CS, IT)'
        });
    }

    req.validatedData = {
        name: nameCheck.sanitized,
        credit: creditCheck.credit,
        level: levelCheck.level,
        is_elective: Boolean(is_elective),
        dept_code: dept_code.toUpperCase()
    };

    next();
};

/**
 * Validates comment submission
 */
const validateComment = (req, res, next) => {
    const { student_id, schedule_version_id, comment } = req.body;

    // 1. Validate student ID (if provided)
    if (student_id) {
        const idCheck = validateId(student_id, 'Student ID');
        if (!idCheck.isValid) {
            return res.status(400).json({ error: idCheck.error });
        }
    }

    // 2. Validate schedule version ID
    const versionCheck = validateId(schedule_version_id, 'Schedule Version ID');
    if (!versionCheck.isValid) {
        return res.status(400).json({ error: versionCheck.error });
    }

    // 3. Validate comment text
    const commentCheck = sanitizeText(comment, 500);
    if (!commentCheck.isValid) {
        return res.status(400).json({ error: 'Comment: ' + commentCheck.error });
    }

    req.validatedData = {
        student_id: student_id ? parseInt(student_id, 10) : null,
        schedule_version_id: versionCheck.id,
        comment: commentCheck.sanitized
    };

    next();
};

/**
 * Validates voting submission
 */
const validateVote = (req, res, next) => {
    const { student_id, course_id, vote_value } = req.body;

    // 1. Validate student ID
    const studentCheck = validateId(student_id, 'Student ID');
    if (!studentCheck.isValid) {
        return res.status(400).json({ error: studentCheck.error });
    }

    // 2. Validate course ID
    const courseCheck = validateId(course_id, 'Course ID');
    if (!courseCheck.isValid) {
        return res.status(400).json({ error: courseCheck.error });
    }

    // 3. Validate vote value (must be 1 or -1)
    const voteNum = parseInt(vote_value, 10);
    if (voteNum !== 1 && voteNum !== -1) {
        return res.status(400).json({ error: 'Vote value must be 1 (approve) or -1 (disapprove)' });
    }

    req.validatedData = {
        student_id: studentCheck.id,
        course_id: courseCheck.id,
        vote_value: voteNum
    };

    next();
};

/**
 * Validates schedule version creation
 */
const validateScheduleVersion = (req, res, next) => {
    const { level, student_count, version_comment, sections } = req.body;

    // 1. Validate level
    const levelCheck = validateLevel(level);
    if (!levelCheck.isValid) {
        return res.status(400).json({ error: levelCheck.error });
    }

    // 2. Validate student count (optional)
    if (student_count !== undefined && student_count !== null) {
        const countNum = parseInt(student_count, 10);
        if (isNaN(countNum) || countNum < 0) {
            return res.status(400).json({ error: 'Student count must be a non-negative number' });
        }
    }

    // 3. Validate version comment (optional)
    if (version_comment) {
        const commentCheck = sanitizeText(version_comment, 200);
        if (!commentCheck.isValid) {
            return res.status(400).json({ error: 'Version comment: ' + commentCheck.error });
        }
    }

    // 4. Validate sections (must be array)
    if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({ error: 'Sections must be an array' });
    }

    req.validatedData = {
        level: levelCheck.level,
        student_count: student_count ? parseInt(student_count, 10) : null,
        version_comment: version_comment ? version_comment.trim() : null,
        sections: sections
    };

    next();
};

/**
 * Validates rule creation
 */
const validateRule = (req, res, next) => {
    const { text } = req.body;

    const textCheck = sanitizeText(text, 1000);
    if (!textCheck.isValid) {
        return res.status(400).json({ error: 'Rule text: ' + textCheck.error });
    }

    req.validatedData = {
        text: textCheck.sanitized
    };

    next();
};

/**
 * General ID parameter validator (for routes with :id)
 */
const validateIdParam = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        const idCheck = validateId(id, 'ID');

        if (!idCheck.isValid) {
            return res.status(400).json({ error: idCheck.error });
        }

        req.validatedId = idCheck.id;
        next();
    };
};

module.exports = {
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
};
