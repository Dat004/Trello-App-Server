const Activity = require('../models/Activity.model');
const { getActivitiesSchema } = require('../utils/validationSchemas');

const fetchActivities = async (baseQuery, reqQuery) => {
    let { limit = 50, skip = 0, action } = reqQuery;

    limit = parseInt(limit);
    skip = parseInt(skip);

    const query = { ...baseQuery };
    if (action) query.action = action;

    // Lấy dư 1 item để kiểm tra hasMore
    const activities = await Activity.find(query)
        .populate('actor', '_id full_name avatar.url')
        .populate('workspace', '_id name')
        .populate('board', '_id title')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit + 1);

    let hasMore = false;
    if (activities.length > limit) {
        hasMore = true;
        activities.pop(); // Bỏ item thứ (limit + 1) đi, chỉ trả về đúng limit
    }

    return {
        activities,
        hasMore,
        nextSkip: skip + activities.length
    };
};

// Lấy danh sách activities của workspace
module.exports.getWorkspaceActivities = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const validatedQuery = getActivitiesSchema.parse(req.query);

        const result = await fetchActivities({ workspace: workspaceId }, validatedQuery);

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách activities của workspace thành công',
            data: result
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

        const result = await fetchActivities({ board: boardId }, validatedQuery);

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách activities của board thành công',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

// Lấy danh sách activities của bản thân
module.exports.getMyActivities = async (req, res, next) => {
    try {
        const validatedQuery = getActivitiesSchema.parse(req.query);

        const result = await fetchActivities({ actor: req.user._id }, validatedQuery);

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách activities của bản thân thành công',
            data: result
        });
    } catch (error) {
        next(error);
    }
};
