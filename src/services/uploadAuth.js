const mongoose = require("mongoose");
const Card = require("../models/Card.model");
const Board = require("../models/Board.model");
const Workspace = require("../models/Workspace.model");
const { UPLOAD_INTENTS } = require("../config/upload");
const { defineAbilitiesFor } = require("../permissions/policy");
const PERMISSIONS = require("../permissions/definitions");

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const INTENT_PERMISSION = {
  card_attachment: PERMISSIONS.ATTACHMENT.CREATE,
  card_comments: PERMISSIONS.COMMENT.CREATE,
};

/**
 * Resolve a trusted Cloudinary folder context for the given intent.
 * Avatar always uses the authenticated user. Card intents require a card
 * contextId and write permission on that card's board.
 */
const resolveUploadContext = async ({ intent, contextId, user }) => {
  const config = UPLOAD_INTENTS[intent];
  if (!config) {
    throw httpError(400, "Invalid upload intent");
  }

  if (intent === "avatar") {
    return {
      intent,
      contextId: user._id.toString(),
    };
  }

  const requiredPermission = INTENT_PERMISSION[intent];
  if (!requiredPermission) {
    throw httpError(400, "Invalid upload intent");
  }

  if (!contextId || !mongoose.Types.ObjectId.isValid(contextId)) {
    throw httpError(400, "contextId (card id) is required for this upload");
  }

  const card = await Card.findOne({ _id: contextId, deleted_at: null });
  if (!card) {
    throw httpError(404, "Thẻ không tồn tại");
  }

  const board = await Board.findOne({ _id: card.board, deleted_at: null });
  if (!board) {
    throw httpError(404, "Bảng không tồn tại");
  }

  let workspace = null;
  if (board.workspace) {
    workspace = await Workspace.findOne({
      _id: board.workspace,
      deleted_at: null,
    });
  }

  const abilities = defineAbilitiesFor(user, { board, workspace, card });
  if (!abilities.includes(requiredPermission)) {
    throw httpError(403, "Bạn không có quyền tải tệp lên thẻ này");
  }

  return {
    intent,
    contextId: card._id.toString(),
  };
};

module.exports = {
  resolveUploadContext,
  INTENT_PERMISSION,
};
