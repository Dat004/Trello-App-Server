const Comment = require("../models/Comment.model");

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
          thread_id: comment._id,
          deleted_at: null,
        });

        return {
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
    const rootCommentId = req.params.commentId;

    // Kiểm tra root comment có tồn tại không
    const rootComment = await Comment.findById(rootCommentId);
    if (!rootComment) {
      return res.status(404).json({
        success: false,
        message: "Comment không tồn tại",
      });
    }

    // Lấy tất cả comments trong thread (root + tất cả replies)
    const comments = await Comment.find({
      $or: [
        { _id: rootCommentId },
        { thread_id: rootCommentId }
      ],
      deleted_at: null,
    })
      .sort({ created_at: 1 })
      .populate("author", "full_name avatar")
      .populate("mentions", "full_name avatar");

    res.status(200).json({
      success: true,
      message: "Lấy thread thành công",
      data: { comments },
    });
  } catch (error) {
    next(error);
  }
};


module.exports.destroyComment = async (req, res, next) => {
  try {
    await Comment.findByIdAndDelete(req.params.commentId);

    res.status(200).json({
      success: true,
      message: "Xóa comment thành công",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
