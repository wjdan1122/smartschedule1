// server/middleware/auth.js
// ========================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ========================================

const jwt = require('jsonwebtoken');

/**
 * Verifies JWT token from Authorization header
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Attach user info to request
        req.user = user;
        next();
    });
};

/**
 * Helper function to check if user has a specific role pattern
 */
const hasRoleLike = (user, ...patterns) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    return patterns.some((p) => role.includes(p));
};

/**
 * Requires user to be a Scheduler
 */
const requireScheduler = (req, res, next) => {
    if (!hasRoleLike(req.user, 'schedule', 'scheduler')) {
        return res.status(403).json({
            error: 'Scheduler privileges required',
            required_role: 'scheduler',
            your_role: req.user?.role || 'unknown'
        });
    }
    next();
};

/**
 * Requires user to be in Load Committee
 */
const requireCommitteeRole = (req, res, next) => {
    if (!hasRoleLike(req.user, 'committee', 'load committee')) {
        return res.status(403).json({
            error: 'Load Committee privileges required',
            required_role: 'load committee',
            your_role: req.user?.role || 'unknown'
        });
    }
    next();
};

/**
 * Requires user to be Faculty
 */
const requireFaculty = (req, res, next) => {
    if (!hasRoleLike(req.user, 'faculty')) {
        return res.status(403).json({
            error: 'Faculty privileges required',
            required_role: 'faculty member',
            your_role: req.user?.role || 'unknown'
        });
    }
    next();
};

/**
 * Requires user to be Staff (Scheduler OR Committee)
 */
const requireStaff = (req, res, next) => {
    if (hasRoleLike(req.user, 'schedule', 'scheduler', 'committee', 'load committee')) {
        return next();
    }
    return res.status(403).json({
        error: 'Staff privileges required',
        required_role: 'scheduler or committee',
        your_role: req.user?.role || 'unknown'
    });
};

/**
 * Requires user to be a Student
 */
const requireStudent = (req, res, next) => {
    if (req.user?.type === 'student' || hasRoleLike(req.user, 'student')) {
        return next();
    }
    return res.status(403).json({
        error: 'Student privileges required',
        required_role: 'student',
        your_role: req.user?.role || 'unknown'
    });
};

/**
 * Allows access to the user's own data only
 * Compares user_id from token with user_id in request params
 */
const requireOwnData = (req, res, next) => {
    const tokenUserId = req.user?.user_id || req.user?.id;
    const requestedUserId = parseInt(req.params.user_id || req.params.id, 10);

    if (!tokenUserId || !requestedUserId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (tokenUserId !== requestedUserId) {
        return res.status(403).json({
            error: 'You can only access your own data',
            detail: 'Unauthorized access to another user\'s information'
        });
    }

    next();
};

/**
 * Allows access if user owns the data OR is staff
 */
const requireOwnDataOrStaff = (req, res, next) => {
    const tokenUserId = req.user?.user_id || req.user?.id;
    const requestedUserId = parseInt(req.params.user_id || req.params.id, 10);

    // Check if staff first
    if (hasRoleLike(req.user, 'schedule', 'scheduler', 'committee', 'load committee')) {
        return next();
    }

    // Otherwise, must be own data
    if (!tokenUserId || !requestedUserId || tokenUserId !== requestedUserId) {
        return res.status(403).json({
            error: 'Access denied',
            detail: 'You can only access your own data'
        });
    }

    next();
};

/**
 * Verifies committee password from request body
 * (Used for registration and sensitive operations)
 */
const verifyCommitteePassword = (req, res, next) => {
    // Committee password verification disabled per latest requirements
    next();
};

module.exports = {
    authenticateToken,
    requireScheduler,
    requireCommitteeRole,
    requireFaculty,
    requireStaff,
    requireStudent,
    requireOwnData,
    requireOwnDataOrStaff,
    verifyCommitteePassword,
    hasRoleLike
};