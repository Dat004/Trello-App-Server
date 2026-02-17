const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const List = require("../models/List.model");
const Card = require("../models/Card.model");
const Comment = require("../models/Comment.model");
const Attachment = require("../models/Attachment.model");

// Middleware to load context (Workspace, Board, List, Card, Comment, Attachment) based on ID params.
const loadContext = async (req, res, next) => {
    const { workspaceId, boardId, listId, cardId, commentId, attachmentId } = req.params;
    req.context = {};

    try {
        // 0. Load Attachment (deepest level for files)
        if (attachmentId) {
            const attachment = await Attachment.findOne({ _id: attachmentId, deleted_at: null });
            if (!attachment) {
                const err = new Error("Tệp đính kèm không tồn tại");
                err.statusCode = 404;
                return next(err);
            }
            req.context.attachment = attachment;
            req.attachment = attachment;

            // Populate card from attachment if missing in params
            if (!cardId && attachment.card) {
                const card = await Card.findOne({ _id: attachment.card, deleted_at: null });
                if (card) {
                    req.context.card = card;
                    req.card = card;

                    // Continue chain if needed
                    if (!boardId && card.board) {
                        const board = await Board.findOne({ _id: card.board, deleted_at: null });
                        if (board) {
                            req.context.board = board;
                            req.board = board;
                        }
                    }
                }
            }
        }

        // 0.5. Load Comment (deepest level for text)
        if (commentId) {
            const comment = await Comment.findOne({ _id: commentId, deleted_at: null });
            if (!comment) {
                const err = new Error("Bình luận không tồn tại");
                err.statusCode = 404;
                return next(err);
            }
            req.context.comment = comment;
            req.comment = comment;

            // Populate card from comment if missing
            if (!cardId && comment.card) {
                const card = await Card.findOne({ _id: comment.card, deleted_at: null });
                if (card) {
                    req.context.card = card;
                    req.card = card;

                    // Continue chain if needed
                    if (!boardId && card.board) {
                        const board = await Board.findOne({ _id: card.board, deleted_at: null });
                        if (board) {
                            req.context.board = board;
                            req.board = board;
                        }
                    }
                }
            }
        }

        // 1. Load Card
        if (cardId) {
            const card = await Card.findOne({ _id: cardId, deleted_at: null });
            if (!card) {
                const err = new Error("Thẻ không tồn tại");
                err.statusCode = 404;
                return next(err);
            }
            req.context.card = card;
            req.card = card;

            // Load parent Board if not already implied
            if (!boardId && card.board && !req.board) {
                const board = await Board.findOne({ _id: card.board, deleted_at: null });
                if (board) {
                    req.context.board = board;
                    req.board = board;
                }
            }
        }

        // 2. Load List
        if (listId) {
            const list = await List.findOne({ _id: listId, deleted_at: null });
            if (!list) {
                const err = new Error("Danh sách không tồn tại");
                err.statusCode = 404;
                return next(err);
            }
            req.context.list = list;
            req.list = list;

            if (!boardId && list.board && !req.board) {
                const board = await Board.findOne({ _id: list.board, deleted_at: null });
                if (board) {
                    req.context.board = board;
                    req.board = board;
                }
            }
        }

        // 3. Load Board (if params exist or explicitly fetched above)
        if (boardId && !req.board) {
            const board = await Board.findOne({ _id: boardId, deleted_at: null });
            if (!board) {
                const err = new Error("Bảng không tồn tại");
                err.statusCode = 404;
                return next(err);
            }
            req.context.board = board;
            req.board = board;
        }

        // 4. Load Workspace
        if (req.board && req.board.workspace && !workspaceId) {
            const workspace = await Workspace.findOne({ _id: req.board.workspace, deleted_at: null });
            if (workspace) {
                req.context.workspace = workspace;
                req.workspace = workspace;
            }
        } else if (workspaceId) {
            const workspace = await Workspace.findOne({ _id: workspaceId, deleted_at: null });
            if (!workspace) {
                const err = new Error("Workspace không tồn tại");
                err.statusCode = 404;
                return next(err);
            }
            req.context.workspace = workspace;
            req.workspace = workspace;
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = loadContext;
