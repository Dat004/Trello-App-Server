const mongoose = require("mongoose");
const Template = require("../models/Template.model");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const List = require("../models/List.model");
const Card = require("../models/Card.model");
const withTransaction = require("../services/common/withTransaction");
const { createBoardFromTemplateSchema } = require("../utils/validationSchemas");

// Lấy tất cả templates active, sorted by popularity
module.exports.getAllTemplates = async (req, res, next) => {
    try {
        const { limit } = req.query;
        const limitNum = limit ? parseInt(limit) : 50;

        const templates = await Template.getAllActive(limitNum);

        res.status(200).json({
            success: true,
            message: "Lấy danh sách templates thành công",
            data: { templates },
        });
    } catch (error) {
        next(error);
    }
};

// Lấy templates phổ biến
module.exports.getPopularTemplates = async (req, res, next) => {
    try {
        const { limit } = req.query;
        const limitNum = limit ? parseInt(limit) : 10;

        const templates = await Template.getPopular(limitNum);

        res.status(200).json({
            success: true,
            message: "Lấy danh sách templates phổ biến thành công",
            data: { templates },
        });
    } catch (error) {
        next(error);
    }
};

// Lấy templates theo category
module.exports.getTemplatesByCategory = async (req, res, next) => {
    try {
        const { category } = req.params;
        const { limit } = req.query;
        const limitNum = limit ? parseInt(limit) : 20;

        const templates = await Template.getByCategory(category, limitNum);

        res.status(200).json({
            success: true,
            message: `Lấy danh sách templates thuộc danh mục ${category} thành công`,
            data: { templates },
        });
    } catch (error) {
        next(error);
    }
};

// Lấy chi tiết template
module.exports.getTemplateById = async (req, res, next) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            const error = new Error("Template ID không hợp lệ");
            error.statusCode = 400;
            return next(error);
        }

        const template = await Template.findOne({
            _id: templateId,
            is_active: true,
        });

        if (!template) {
            const error = new Error("Template không tồn tại hoặc đã bị vô hiệu hóa");
            error.statusCode = 404;
            return next(error);
        }

        res.status(200).json({
            success: true,
            message: "Lấy chi tiết template thành công",
            data: { template },
        });
    } catch (error) {
        next(error);
    }
};

// Tạo board từ template
module.exports.createBoardFromTemplate = async (req, res, next) => {
    try {
        const { templateId } = req.params;
        const validatedData = createBoardFromTemplateSchema.parse(req.body);

        // Validate templateId
        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            const error = new Error("Template ID không hợp lệ");
            error.statusCode = 400;
            return next(error);
        }

        // Lấy template
        const template = await Template.findOne({
            _id: templateId,
            is_active: true,
        });

        if (!template) {
            const error = new Error("Template không tồn tại hoặc đã bị vô hiệu hóa");
            error.statusCode = 404;
            return next(error);
        }

        // Tạo board data
        const boardTitle = validatedData.title || template.name;
        const boardData = {
            title: boardTitle,
            description: template.description,
            color: template.color,
            visibility: validatedData.workspaceId ? "workspace" : "private",
            workspace: validatedData.workspaceId,
            owner: req.user._id,
            members: [{ user: req.user._id, role: "admin" }],
        };

        // Nếu có workspaceId, gán board vào workspace
        if (validatedData.workspaceId) {
            if (!mongoose.Types.ObjectId.isValid(validatedData.workspaceId)) {
                const error = new Error("Workspace ID không hợp lệ");
                error.statusCode = 400;
                return next(error);
            }

            const workspace = await Workspace.findOne({
                _id: validatedData.workspaceId,
                deleted_at: null,
            });

            if (!workspace) {
                const error = new Error("Workspace không tồn tại");
                error.statusCode = 404;
                return next(error);
            }

            // Check user có quyền tạo board trong workspace không
            const isOwner = workspace.owner.equals(req.user._id);
            const member = workspace.members.find((m) =>
                m.user.equals(req.user._id)
            );

            if (!isOwner && !member) {
                const error = new Error(
                    "Bạn không phải thành viên của workspace này"
                );
                error.statusCode = 403;
                return next(error);
            }

            const userRoleInWorkspace = isOwner ? "admin" : member.role;
            const allowedCreate =
                workspace.permissions.canCreateBoard === "admin_member"
                    ? ["admin", "member"]
                    : ["admin"];

            if (!allowedCreate.includes(userRoleInWorkspace)) {
                const error = new Error(
                    "Bạn không có quyền tạo board trong workspace này"
                );
                error.statusCode = 403;
                return next(error);
            }
        }

        const createdBoard = await withTransaction(async (session) => {
            // Tạo board
            const newBoard = await Board.create([boardData], { session });
            const board = newBoard[0];

            // Tạo lists và cards từ template
            for (const [index, templateList] of template.lists.entries()) {
                // Tạo list
                const listData = {
                    title: templateList.name,
                    board: board._id,
                    workspace: board.workspace || null,
                    pos: 65536 * (index + 1),
                    color: templateList.color,
                };

                const newList = await List.create([listData], { session });
                const createdList = newList[0];

                // Tạo cards cho list này
                if (templateList.example_cards && templateList.example_cards.length > 0) {
                    for (const [cardIndex, templateCard] of templateList.example_cards.entries()) {
                        const cardData = {
                            title: templateCard.title,
                            description: templateCard.description || "",
                            list: createdList._id,
                            board: board._id,
                            workspace: board.workspace || null,
                            pos: 65536 * (cardIndex + 1),
                            creator: req.user._id,
                        };

                        await Card.create([cardData], { session });
                    }
                }
            }

            return board;
        });

        // Tăng usage count cho template
        await template.incrementUsage();

        res.status(201).json({
            success: true,
            message: "Tạo board từ template thành công",
            data: { board: createdBoard },
        });
    } catch (error) {
        next(error);
    }
};
