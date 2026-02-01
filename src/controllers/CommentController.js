const Comment = require("../models/Comment.model");
const { emitToRoom } = require("../utils/socketHelper");
const {
  logCommentCreated,
  logCommentDeleted,
} = require("../services/activity/log");

module.exports.addComment = async (req, res, next) => {
  try {
    const { text, parent_comment, mentions = [] } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Nội dung comment không được rỗng",
      });
    }

    const card = req.card;
    const workspaceId = req.board.workspace;

    // Khởi tạo các trường thread
    let thread_id = null;
    let depth = 0;

    // Nếu đang reply comment khác, tính toán thread_id và depth
    if (parent_comment) {
      const parentComment = await Comment.findOne({
        _id: parent_comment,
        deleted_at: null,
      });

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Comment cha không tồn tại",
        });
      }

      // Set thread_id đến root comment (hoặc thread_id của parent nếu có)
      thread_id = parentComment.thread_id || parentComment._id;

      // Giới hạn depth tối đa ở 3 để tránh nested quá sâu, nhưng vẫn cho phép reply, tối đa 4 level
      depth = Math.min(parentComment.depth + 1, 3);
    }

    const newComment = await Comment.create({
      card: card._id,
      board: card.board,
      workspace: workspaceId,
      text: text.trim(),
      author: req.user._id,
      thread_id,
      parent_comment: parent_comment || null,
      depth,
      mentions,
    });

    await newComment.populate("author", "full_name avatar");

    // Socket.io emit (Cách 2: Loại trừ người gửi nếu có socketId)
    emitToRoom({
      room: `card:${card._id}`,
      event: "comment-added",
      data: newComment,
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logCommentCreated(newComment, card, req.board, req.user._id);

    res.status(201).json({
      success: true,
      message: "Thêm comment thành công",
      data: { comment: newComment },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.getCommentsByCard = async (req, res, next) => {
  try {
    const { limit = 10, skip = 0 } = req.query;

    // Chỉ lấy root comments và chưa bị xóa
    const comments = await Comment.find({
      card: req.params.cardId,
      thread_id: null,
      deleted_at: null,
    })
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("author", "full_name avatar")
      .populate("mentions", "full_name avatar")
      .lean(); // Dùng lean() để có thể thêm field

    // Tính số lượng replies cho mỗi root comment
    const commentsWithReplyCounts = await Promise.all(
      comments.map(async (comment) => {
        const replyCount = await Comment.countDocuments({
          parent_comment: comment._id,
          deleted_at: null,
        });

        return {
          ...comment,
          reply_count: replyCount,
        };
      })
    );

    const totalComments = await Comment.countDocuments({
      card: req.params.cardId,
      thread_id: null,
      deleted_at: null,
    });
    const hasMore = parseInt(skip) + comments.length < totalComments;

    res.status(200).json({
      success: true,
      message: "Lấy comments thành công",
      data: {
        comments: commentsWithReplyCounts,
        hasMore, // Boolean để FE biết có nút "xem thêm" không
        nextSkip: parseInt(skip) + comments.length, // Skip cho lần sau
        total: totalComments,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getThread = async (req, res, next) => {
  try {
    const parentCommentId = req.params.commentId;

    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Comment không tồn tại",
      });
    }

    let comments = [];

    // Nếu parent ở depth >= 2 (tức là con sẽ là depth 3 - max), 
    // thì lấy hết
    if (parentComment.depth >= 2) {
      let currentParentIds = [parentComment._id];
      let iteration = 0;
      const MAX_ITERATIONS = 10; // Safety break

      while (currentParentIds.length > 0 && iteration < MAX_ITERATIONS) {
        // Tìm direct replies của tầng này
        const found = await Comment.find({
          parent_comment: { $in: currentParentIds },
          deleted_at: null,
        })
          .sort({ created_at: 1 })
          .populate("author", "full_name avatar")
          .populate("mentions", "full_name avatar")
          .populate({
            path: "parent_comment",
            select: "author",
            populate: {
              path: "author",
              select: "full_name avatar",
            },
          })
          .lean();

        if (found.length === 0) break;

        // Tách thông tin người được reply ra field riêng
        const foundWithRepliedTo = found.map(c => {
          const reply_to = c.parent_comment?.author || null;
          const { parent_comment, ...rest } = c;
          return {
            ...rest,
            parent_comment: parent_comment?._id || null,
            reply_to,
            reply_count: 0
          };
        });
        comments.push(...foundWithRepliedTo);

        // Lấy con của đám vừa tìm được
        currentParentIds = found.map((c) => c._id);
        iteration++;
      }

      // Sort lại toàn bộ theo thời gian để hiển thị đúng thứ tự
      comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    } else {
      // Chỉ lấy direct children (Lazy load)
      comments = await Comment.find({
        parent_comment: parentCommentId,
        deleted_at: null,
      })
        .sort({ created_at: 1 })
        .populate("author", "full_name avatar")
        .populate("mentions", "full_name avatar")
        .populate({
          path: "parent_comment",
          select: "author",
          populate: {
            path: "author",
            select: "full_name avatar",
          },
        })
        .lean();

      // Tính số lượng replies và tách thông tin người được reply
      comments = await Promise.all(
        comments.map(async (comment) => {
          const replyCount = await Comment.countDocuments({
            parent_comment: comment._id,
            deleted_at: null,
          });

          const reply_to = comment.parent_comment?.author || null;
          const { parent_comment, ...rest } = comment;

          return {
            ...rest,
            parent_comment: parent_comment?._id || null,
            reply_to,
            reply_count: replyCount,
          };
        })
      );
    }

    res.status(200).json({
      success: true,
      message: "Lấy replies thành công",
      data: { comments },
    });
  } catch (error) {
    next(error);
  }
};


module.exports.destroyComment = async (req, res, next) => {
  try {
    const commentId = req.params.commentId;

    const comment = await Comment.findOne({
      _id: commentId,
      deleted_at: null,
    });
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment không tồn tại",
      });
    }

    // Cascade Delete: Tìm và xóa tất cả descendants
    let idsToDelete = [comment._id];
    let currentParentIds = [comment._id];

    // Tìm tất cả con cháu bằng cách duyệt theo parent_comment
    while (currentParentIds.length > 0) {
      const children = await Comment.find({
        parent_comment: { $in: currentParentIds },
        deleted_at: null,
      }).select("_id");

      if (children.length === 0) break;

      const childIds = children.map((c) => c._id);
      idsToDelete.push(...childIds);
      currentParentIds = childIds;
    }

    // Xóa tất cả comments (bao gồm comment gốc và descendants)
    await Comment.deleteMany({ _id: { $in: idsToDelete } });

    // Socket.io emit (Cách 2: Loại trừ người gửi nếu có socketId)
    emitToRoom({
      room: `card:${comment.card}`,
      event: "comment-deleted",
      data: { commentId: comment._id, deletedCount: idsToDelete.length },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    const card = req.card;
    logCommentDeleted(comment, card, req.board, req.user._id);

    res.status(200).json({
      success: true,
      message: `Đã xóa ${idsToDelete.length} comment(s)`,
    });
  } catch (error) {
    next(error);
  }
};
