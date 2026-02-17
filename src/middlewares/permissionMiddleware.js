const { defineAbilitiesFor } = require("../permissions/policy");

// Middleware kiểm tra quyền
const authorize = (action) => {
    return (req, res, next) => {
        // Kiểm tra user
        if (!req.user) {
            const err = new Error("Unauthorized");
            err.statusCode = 401;
            return next(err);
        }

        // Lấy context
        const context = req.context || {};

        // Tính toán quyền
        const allowedActions = defineAbilitiesFor(req.user, context);

        // Kiểm tra quyền
        if (allowedActions.includes(action)) {
            return next();
        }

        // Từ chối quyền
        const err = new Error("Bạn không có quyền thực hiện hành động này (" + action + ")");
        err.statusCode = 403;
        next(err);
    };
};

module.exports = authorize;
