const Board = require("../models/Board.model");
const Card = require("../models/Card.model");
const Workspace = require("../models/Workspace.model");
// const User = require("../models/User.model");
const { searchSchema } = require("../utils/validationSchemas");

module.exports.globalSearch = async (req, res, next) => {
    try {
        const { q, limit } = searchSchema.parse(req.query);
        const userId = req.user._id;

        if (!q.trim()) {
            return res.status(200).json({
                success: true,
                data: {
                    boards: [],
                    cards: [],
                    members: []
                }
            });
        }

        const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const searchRegex = new RegExp(escapedQuery, "i");

        const [memberWorkspaces, adminWorkspaces] = await Promise.all([
            Workspace.find({
                deleted_at: null,
                $or: [{ owner: userId }, { "members.user": userId }],
            }).select("_id").lean(),
            Workspace.find({
                deleted_at: null,
                $or: [
                    { owner: userId },
                    { members: { $elemMatch: { user: userId, role: "admin" } } },
                ],
            }).select("_id").lean(),
        ]);

        const memberWorkspaceIds = memberWorkspaces.map((workspace) => workspace._id);
        const adminWorkspaceIds = adminWorkspaces.map((workspace) => workspace._id);
        const accessibleBoardConditions = [
            { owner: userId },
            { "members.user": userId },
            { visibility: "public" },
            { visibility: "workspace", workspace: { $in: memberWorkspaceIds } },
            { visibility: "private", workspace: { $in: adminWorkspaceIds } },
        ];

        // Tìm Boards
        const boardsPromise = Board.find({
            deleted_at: null,
            archived: false,
            title: searchRegex,
            $or: accessibleBoardConditions,
        })
            .select("_id title color visibility")
            .limit(limit)
            .lean();

        // Tìm Cards
        const myBoardIdsPromise = Board.find({
            deleted_at: null,
            archived: false,
            $or: accessibleBoardConditions,
        }).select("_id").lean();

        /* 
        // Tìm Members
        const membersPromise = User.find({
            $or: [
                { full_name: searchRegex },
                { email: searchRegex }
            ]
        })
        .select("_id full_name email avatar")
        .limit(limit)
        .lean();
        */

        const [boards, myBoardNodes] = await Promise.all([
            boardsPromise,
            myBoardIdsPromise,
            // membersPromise
        ]);

        const myBoardIds = myBoardNodes.map(b => b._id);

        // Tìm Cards dựa trên Board IDs đã lọc
        const cards = await Card.find({
            deleted_at: null,
            archived: false,
            board: { $in: myBoardIds },
            title: searchRegex
        })
            .select("_id title board list description labels due_date")
            .populate("board", "title")
            .limit(limit)
            .lean();

        const formattedCards = cards.map(card => ({
            _id: card._id,
            title: card.title,
            boardId: card.board?._id,
            boardTitle: card.board?.title,
            type: "card",
            labels: card.labels,
            description: card.description ? true : false
        }));

        // Trả về kết quả
        res.status(200).json({
            success: true,
            data: {
                boards: boards.map(b => ({ ...b, type: "board" })),
                cards: formattedCards,
                members: []
                /*
                members: members.map(m => ({
                    _id: m._id,
                    displayName: m.full_name,
                    avatar: m.avatar?.url,
                    email: m.email,
                    type: "member"
                }))
                */
            }
        });

    } catch (error) {
        console.error("[Search Controller Error]:", error);
        next(error);
    }
};
