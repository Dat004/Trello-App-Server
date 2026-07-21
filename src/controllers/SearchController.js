const Board = require("../models/Board.model");
const Card = require("../models/Card.model");
const Workspace = require("../models/Workspace.model");
// const User = require("../models/User.model");
const { searchSchema } = require("../utils/validationSchemas");

module.exports.globalSearch = async (req, res, next) => {
    try {
        const { q, limit, skip } = searchSchema.parse(req.query);
        const userId = req.user._id;

        if (!q.trim()) {
            return res.status(200).json({
                success: true,
                data: {
                    boards: [],
                    cards: [],
                    members: [],
                    pagination: {
                        skip: 0,
                        limit,
                        hasMoreBoards: false,
                        hasMoreCards: false,
                        nextSkip: 0,
                    },
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

        const boardsPromise = Board.find({
            deleted_at: null,
            archived: false,
            title: searchRegex,
            $or: accessibleBoardConditions,
        })
            .select("_id title color visibility")
            .skip(skip)
            .limit(limit + 1)
            .lean();

        const myBoardIdsPromise = Board.find({
            deleted_at: null,
            archived: false,
            $or: accessibleBoardConditions,
        }).select("_id").lean();

        const [boardsRaw, myBoardNodes] = await Promise.all([
            boardsPromise,
            myBoardIdsPromise,
        ]);

        const hasMoreBoards = boardsRaw.length > limit;
        const boards = hasMoreBoards ? boardsRaw.slice(0, limit) : boardsRaw;
        const myBoardIds = myBoardNodes.map(b => b._id);

        const cardsRaw = await Card.find({
            deleted_at: null,
            archived: false,
            board: { $in: myBoardIds },
            title: searchRegex
        })
            .select("_id title board list description labels due_date")
            .populate("board", "title")
            .skip(skip)
            .limit(limit + 1)
            .lean();

        const hasMoreCards = cardsRaw.length > limit;
        const cards = hasMoreCards ? cardsRaw.slice(0, limit) : cardsRaw;

        const formattedCards = cards.map(card => ({
            _id: card._id,
            title: card.title,
            boardId: card.board?._id,
            boardTitle: card.board?.title,
            type: "card",
            labels: card.labels,
            description: card.description ? true : false
        }));

        res.status(200).json({
            success: true,
            data: {
                boards: boards.map(b => ({ ...b, type: "board" })),
                cards: formattedCards,
                members: [],
                pagination: {
                    skip,
                    limit,
                    hasMoreBoards,
                    hasMoreCards,
                    nextSkip: skip + limit,
                },
            }
        });

    } catch (error) {
        console.error("[Search Controller Error]:", error);
        next(error);
    }
};
