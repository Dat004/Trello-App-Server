const { defineAbilitiesFor } = require("../permissions/policy");

/**
 * Middleware to enforce permissions
 * @param {String} action - The required action (e.g., 'board:edit')
 */
const authorize = (action) => {
    return (req, res, next) => {
        // Ensure context is loaded (req.user and req.context required)
        if (!req.user) {
            const err = new Error("Unauthorized");
            err.statusCode = 401;
            return next(err);
        }

        const context = req.context || {};

        // Calculate abilities
        const allowedActions = defineAbilitiesFor(req.user, context);

        if (allowedActions.includes(action)) {
            return next();
        }

        // Permission Denied
        const err = new Error("Bạn không có quyền thực hiện hành động này (" + action + ")");
        err.statusCode = 403;
        next(err);
    };
};

module.exports = authorize;
