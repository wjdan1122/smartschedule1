// server/utils/validators.js
// ========================================
// VALIDATION HELPER FUNCTIONS
// ========================================

const validator = require('validator');

/**
 * Validates KSU email format with 8-digit student ID
 * @param {string} email - Email to validate
 * @returns {object} { isValid: boolean, error: string, type: 'student'|'staff' }
 */
const validateKSUEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if it's a valid email format first
    if (!validator.isEmail(trimmedEmail)) {
        return { isValid: false, error: 'Invalid email format' };
    }

    // Student email: 9 digits + @student.ksu.edu.sa
    const studentPattern = /^[0-9]{9}@student\.ksu\.edu\.sa$/;
    if (studentPattern.test(trimmedEmail)) {
        return { isValid: true, type: 'student', email: trimmedEmail };
    }

    // Staff email: anything + @ksu.edu.sa (but NOT @student.ksu.edu.sa)
    const staffPattern = /^[a-zA-Z0-9._-]+@ksu\.edu\.sa$/;
    if (staffPattern.test(trimmedEmail)) {
        return { isValid: true, type: 'staff', email: trimmedEmail };
    }

    return {
        isValid: false,
        error: 'Email must be: 9 digits for students (e.g., 123456789@student.ksu.edu.sa) or staff email (@ksu.edu.sa)'
    };
};

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, error: string }
 */
const validatePassword = (password) => {
    if (!password || typeof password !== 'string') {
        return { isValid: false, error: 'Password is required' };
    }

    if (password.length < 6) {
        return { isValid: false, error: 'Password must be at least 6 characters long' };
    }

    if (password.length > 128) {
        return { isValid: false, error: 'Password is too long (max 128 characters)' };
    }

    // Optional: Check for common weak passwords
    const weakPasswords = ['123456', 'password', '123456789', 'qwerty', 'abc123'];
    if (weakPasswords.includes(password.toLowerCase())) {
        return {
            isValid: false,
            error: 'Password is too weak. Try 6-20 characters with upper/lowercase letters, a number, and a symbol'
        };
    }

    return { isValid: true };
};

/**
 * Validates and sanitizes a name
 * @param {string} name - Name to validate
 * @returns {object} { isValid: boolean, error: string, sanitized: string }
 */
const validateName = (name) => {
    if (!name || typeof name !== 'string') {
        return { isValid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { isValid: false, error: 'Name must be at least 2 characters long' };
    }

    if (trimmed.length > 100) {
        return { isValid: false, error: 'Name is too long (max 100 characters)' };
    }

    // Allow letters, spaces, Arabic characters, hyphens
    const namePattern = /^[\p{L}\s'-]+$/u;
    if (!namePattern.test(trimmed)) {
        return { isValid: false, error: 'Name contains invalid characters' };
    }

    // Sanitize: escape HTML
    const sanitized = validator.escape(trimmed);

    return { isValid: true, sanitized };
};

/**
 * Validates student level
 * @param {number} level - Level to validate
 * @returns {object} { isValid: boolean, error: string }
 */
const validateLevel = (level) => {
    const levelNum = parseInt(level, 10);

    if (isNaN(levelNum)) {
        return { isValid: false, error: 'Level must be a number' };
    }

    if (levelNum < 1 || levelNum > 12) {
        return { isValid: false, error: 'Level must be between 1 and 12' };
    }

    return { isValid: true, level: levelNum };
};

/**
 * Validates user role
 * @param {string} role - Role to validate
 * @param {string} emailType - 'student' or 'staff'
 * @returns {object} { isValid: boolean, error: string, sanitized: string }
 */
const validateRole = (role, emailType) => {
    const allowedRoles = [
        'student',
        'register',
        'registrar',
        'faculty member',
        'load committee',
        'schedule',
        'scheduler'
    ];

    if (!role || typeof role !== 'string') {
        if (emailType === 'student') {
            return { isValid: true, sanitized: 'student' }; // Auto-assign for students
        }
        return { isValid: false, error: 'Role is required for staff accounts' };
    }

    const trimmed = role.trim().toLowerCase();

    if (!allowedRoles.includes(trimmed)) {
        return {
            isValid: false,
            error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`
        };
    }

    // Students can only have 'student' role
    if (emailType === 'student' && trimmed !== 'student') {
        return { isValid: true, sanitized: 'student' }; // Force student role
    }

    // Staff cannot have 'student' role
    if (emailType === 'staff' && trimmed === 'student') {
        return { isValid: false, error: 'Staff email cannot have student role' };
    }

    return { isValid: true, sanitized: trimmed };
};

/**
 * Sanitizes text input (comments, descriptions, etc.)
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {object} { isValid: boolean, error: string, sanitized: string }
 */
const sanitizeText = (text, maxLength = 1000) => {
    if (!text || typeof text !== 'string') {
        return { isValid: false, error: 'Text is required' };
    }

    const trimmed = text.trim();

    if (trimmed.length === 0) {
        return { isValid: false, error: 'Text cannot be empty' };
    }

    if (trimmed.length > maxLength) {
        return { isValid: false, error: `Text is too long (max ${maxLength} characters)` };
    }

    // Escape HTML to prevent XSS
    const sanitized = validator.escape(trimmed);

    return { isValid: true, sanitized };
};

/**
 * Validates integer ID (student_id, course_id, etc.)
 * @param {any} id - ID to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {object} { isValid: boolean, error: string, id: number }
 */
const validateId = (id, fieldName = 'ID') => {
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
        return { isValid: false, error: `${fieldName} must be a valid number` };
    }

    if (numId < 1) {
        return { isValid: false, error: `${fieldName} must be a positive number` };
    }

    return { isValid: true, id: numId };
};

/**
 * Validates committee password
 * @param {string} password - Committee password from request
 * @returns {object} { isValid: boolean, error: string }
 */
const validateCommitteePassword = () => {
    // Committee password checks disabled per latest requirements
    return { isValid: true };
};

/**
 * Validates course credit hours
 * @param {any} credit - Credit hours to validate
 * @returns {object} { isValid: boolean, error: string, credit: number }
 */
const validateCredit = (credit) => {
    const creditNum = parseInt(credit, 10);

    if (isNaN(creditNum)) {
        return { isValid: false, error: 'Credit hours must be a number' };
    }

    if (creditNum < 1 || creditNum > 6) {
        return { isValid: false, error: 'Credit hours must be between 1 and 6' };
    }

    return { isValid: true, credit: creditNum };
};

module.exports = {
    validateKSUEmail,
    validatePassword,
    validateName,
    validateLevel,
    validateRole,
    sanitizeText,
    validateId,
    validateCommitteePassword,
    validateCredit
};
