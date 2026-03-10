const Template = require("../models/Template.model");
const Board = require("../models/Board.model");
const List = require("../models/List.model");
const Card = require("../models/Card.model");
const { generateTemplateSchema, analyzeBoardSchema } = require("../utils/validationSchemas");
const { generateTemplateFromAI, analyzeBoardData } = require("../services/ai/gemini.service");
const { logActivity } = require("../services/activity/log");
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require("../constants/activities");

// Tạo template board bằng AI dựa trên prompt
module.exports.generateTemplate = async (req, res, next) => {
    try {
        // Xác thực dữ liệu đầu vào
        const validatedData = generateTemplateSchema.parse(req.body);
        const { prompt, language, workspaceId } = validatedData;

        // Gọi service AI để tạo nội dung template
        const aiResult = await generateTemplateFromAI(prompt, language);
        const { template: aiTemplate, usage } = aiResult;

        // Lưu dưới dạng template cá nhân (is_system: false) của người dùng
        const newTemplateData = {
            name: `${aiTemplate.name} (AI)`,
            description: aiTemplate.description,
            category: aiTemplate.category || "project-management",
            lists: aiTemplate.lists.map(list => ({
                name: list.name,
                position: list.position || 0,
                color: "bg-blue-600", // Mặc định
                example_cards: list.cards.map(card => ({
                    title: card.title,
                    description: card.description || "",
                    checklist: card.checklist || [],
                    labels: card.labels || []
                }))
            })),
            tags: aiTemplate.tags || [],
            is_system: false,
            created_by: req.user._id,
            is_ai_generated: true,
            ai_metadata: {
                prompt,
                model: "gemini-2.5-flash",
                usage,
                generated_at: new Date()
            }
        };

        // Lưu vào Database
        let savedTemplate;
        try {
            savedTemplate = await Template.create(newTemplateData);
        } catch (dbError) {
            // Nếu tên bị trùng (do unique: true), chúng ta thêm timestamp
            if (dbError.code === 11000) {
                newTemplateData.name += ` - ${Date.now()}`;
                savedTemplate = await Template.create(newTemplateData);
            } else {
                throw dbError;
            }
        }

        // Ghi log hoạt động
        await logActivity({
            action: ACTIVITY_ACTIONS.TEMPLATE_GENERATED,
            entityType: ENTITY_TYPES.TEMPLATE,
            entityId: savedTemplate._id,
            workspace: workspaceId || null,
            actor: req.user._id,
            metadata: {
                prompt,
                template_name: savedTemplate.name
            }
        });

        // Trả về kết quả cho FE
        res.status(201).json({
            success: true,
            message: "Tạo template bằng AI thành công",
            data: {
                template: savedTemplate
            }
        });

    } catch (error) {
        console.error("[AI Controller Error]:", error);
        next(error);
    }
};

// Phân tích dữ liệu Board bằng AI
module.exports.analyzeBoard = async (req, res, next) => {
    try {
        const board = req.board;
        const boardId = board._id;
        const { query } = analyzeBoardSchema.parse(req.body);

        // Lấy dữ liệu Lists và Cards
        const lists = await List.find({ board: boardId, deleted_at: null }).sort({ pos: 1 });
        const cards = await Card.find({ board: boardId, deleted_at: null, archived: false })
            .populate("members", "full_name")
            .sort({ pos: 1 });

        // Nhào nặn dữ liệu (Làm mỏng JSON)
        const cardsByList = {};
        cards.forEach(card => {
            if (!cardsByList[card.list]) cardsByList[card.list] = [];
            cardsByList[card.list].push({
                title: card.title,
                description: card.description ? "Có" : "Không",
                dueDate: card.due_date ? new Date(card.due_date).toLocaleDateString('vi-VN') : null,
                isCompleted: card.due_complete,
                members: card.members.map(m => m.full_name),
                labels: card.labels.map(l => l.name)
            });
        });

        const simplifiedBoardData = {
            boardName: board.title,
            description: board.description,
            currentDate: new Date().toLocaleDateString('vi-VN'),
            lists: lists.map(list => ({
                listName: list.title,
                cards: cardsByList[list._id] || []
            }))
        };

        // Gọi AI để phân tích
        const aiResponse = await analyzeBoardData(simplifiedBoardData, query);

        res.status(200).json({
            success: true,
            message: "Phân tích thành công",
            data: {
                response: aiResponse
            }
        });

    } catch (error) {
        console.error("[AI Analyze Error]:", error);
        next(error);
    }
};
