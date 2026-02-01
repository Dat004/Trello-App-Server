const Activity = require('../models/Activity.model');
const { getActivitiesSchema } = require('../utils/validationSchemas');

// Lấy danh sách activities của workspace
module.exports.getWorkspaceActivities = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const validatedQuery = getActivitiesSchema.parse(req.query);

        const { limit = 50, skip = 0, action } = validatedQuery;

        const query = { workspace: workspaceId };
        if (action) query.action = action;

        const activities = await Activity.find(query)
            .populate('actor', '_id full_name avatar.url')
            .sort({ created_at: -1 })
            .skip(parseInt(skip))
            .limit(Math.min(parseInt(limit), 100));

        const total = await Activity.countDocuments(query);
        const hasMore = parseInt(skip) + activities.length < total;

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách activities của workspace thành công',
            data: {
                activities,
                hasMore,
                nextSkip: parseInt(skip) + activities.length,
                total
            }
        });
    } catch (error) {
        next(error);
    }
};

// Lấy danh sách activities của board
module.exports.getBoardActivities = async (req, res, next) => {
    try {
        const { boardId } = req.params;
        const validatedQuery = getActivitiesSchema.parse(req.query);

        const { limit = 50, skip = 0, action } = validatedQuery;

        const query = { board: boardId };
        if (action) query.action = action;

        const activities = await Activity.find(query)
            .populate('actor', '_id full_name avatar.url')
            .sort({ created_at: -1 })
            .skip(parseInt(skip))
            .limit(Math.min(parseInt(limit), 100));

        const total = await Activity.countDocuments(query);
        const hasMore = parseInt(skip) + activities.length < total;

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách activities của board thành công',
            data: {
                activities,
                hasMore,
                nextSkip: parseInt(skip) + activities.length,
                total
            }
        });
    } catch (error) {
        next(error);
    }
};

// Lấy danh sách activities của bản thân
module.exports.getMyActivities = async (req, res, next) => {
    try {
        const validatedQuery = getActivitiesSchema.parse(req.query);
        const { limit = 50, skip = 0, action } = validatedQuery;

        const query = { actor: req.user._id };
        if (action) query.action = action;

        const activities = await Activity.find(query)
            .populate('workspace', '_id name')
            .populate('board', '_id title')
            .sort({ created_at: -1 })
            .skip(parseInt(skip))
            .limit(Math.min(parseInt(limit), 100));

        const total = await Activity.countDocuments(query);
        const hasMore = parseInt(skip) + activities.length < total;

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách activities của bản thân thành công',
            data: {
                activities,
                hasMore,
                nextSkip: parseInt(skip) + activities.length,
                total
            }
        });
    } catch (error) {
        next(error);
    }
};
