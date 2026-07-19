const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const List = require("../models/List.model");
const Card = require("../models/Card.model");
const Comment = require("../models/Comment.model");
const Attachment = require("../models/Attachment.model");

const getParam = (params, names) => {
    for (const name of names) {
        if (params[name]) return params[name];
    }
    return null;
};

const notFound = (message) => {
    const err = new Error(message);
    err.statusCode = 404;
    return err;
};

// Load and bind every explicitly nested resource to its parent. Returning 404 for
// a mismatched chain avoids revealing whether an unrelated resource exists.
const loadContext = async (req, res, next) => {
    const workspaceId = getParam(req.params, ["workspaceId", "workspace_id"]);
    const boardId = getParam(req.params, ["boardId", "board_id"]);
    const listId = getParam(req.params, ["listId", "list_id"]);
    const cardId = getParam(req.params, ["cardId", "card_id"]);
    const commentId = getParam(req.params, ["commentId", "comment_id"]);
    const attachmentId = getParam(req.params, ["attachmentId", "attachment_id"]);
    req.context = {};

    try {
        let board = null;
        let list = null;
        let card = null;

        if (boardId) {
            const boardQuery = { _id: boardId, deleted_at: null };
            if (workspaceId) boardQuery.workspace = workspaceId;
            board = await Board.findOne(boardQuery);
            if (!board) return next(notFound("Bảng không tồn tại"));
        }

        if (listId) {
            const listQuery = { _id: listId, deleted_at: null };
            if (boardId) listQuery.board = boardId;
            list = await List.findOne(listQuery);
            if (!list) return next(notFound("Danh sách không tồn tại"));
        }

        if (cardId) {
            const cardQuery = { _id: cardId, deleted_at: null };
            if (boardId) cardQuery.board = boardId;
            if (listId) cardQuery.list = listId;
            card = await Card.findOne(cardQuery);
            if (!card) return next(notFound("Thẻ không tồn tại"));
        }

        if (!card && (commentId || attachmentId)) {
            const Resource = commentId ? Comment : Attachment;
            const resourceId = commentId || attachmentId;
            const resource = await Resource.findOne({ _id: resourceId, deleted_at: null });
            if (!resource) {
                return next(notFound(commentId ? "Bình luận không tồn tại" : "Tệp đính kèm không tồn tại"));
            }
            const parentCardQuery = { _id: resource.card, deleted_at: null };
            if (boardId) parentCardQuery.board = boardId;
            card = await Card.findOne(parentCardQuery);
            if (!card) return next(notFound("Thẻ không tồn tại"));
        }

        if (!board) {
            const parentBoardId = (card && card.board) || (list && list.board);
            if (parentBoardId) {
                board = await Board.findOne({ _id: parentBoardId, deleted_at: null });
                if (!board) return next(notFound("Bảng không tồn tại"));
            }
        }

        if (list) {
            req.context.list = list;
            req.list = list;
        }
        if (card) {
            req.context.card = card;
            req.card = card;
        }
        if (board) {
            req.context.board = board;
            req.board = board;
        }

        if (commentId) {
            const commentQuery = { _id: commentId, deleted_at: null };
            if (cardId) commentQuery.card = cardId;
            if (board) commentQuery.board = board._id;
            const comment = await Comment.findOne(commentQuery);
            if (!comment) return next(notFound("Bình luận không tồn tại"));
            req.context.comment = comment;
            req.comment = comment;
        }

        if (attachmentId) {
            const attachmentQuery = { _id: attachmentId, deleted_at: null };
            if (cardId) attachmentQuery.card = cardId;
            if (board) attachmentQuery.board = board._id;
            const attachment = await Attachment.findOne(attachmentQuery);
            if (!attachment) return next(notFound("Tệp đính kèm không tồn tại"));
            req.context.attachment = attachment;
            req.attachment = attachment;
        }

        const resolvedWorkspaceId = workspaceId || (board && board.workspace);
        if (resolvedWorkspaceId) {
            const workspace = await Workspace.findOne({ _id: resolvedWorkspaceId, deleted_at: null });
            if (!workspace) return next(notFound("Workspace không tồn tại"));
            req.context.workspace = workspace;
            req.workspace = workspace;
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = loadContext;
