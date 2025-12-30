const Comment = require("../models/Comment.model");

module.exports.addComment = async (req, res, next) => {
  try {
    const { text, reply_to, mentions = [] } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Nội dung comment không được rỗng",
      });
    }

    const card = req.card;
    const newComment = await Comment.create({
      card: card._id,
      board: card.board,
      text: text.trim(),
      author: req.user._id,
      reply_to: reply_to || null,
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

    const comments = await Comment.find({ card: req.params.cardId })
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("author", "full_name avatar")
      .populate("mentions", "full_name avatar");

    const totalComments = await Comment.countDocuments({
      card: req.params.cardId,
    });
    const hasMore = parseInt(skip) + comments.length < totalComments;

    res.status(200).json({
      success: true,
      message: "Lấy comments thành công",
      data: {
        comments,
        hasMore, // Boolean để FE biết có nút "xem thêm" không
        nextSkip: parseInt(skip) + comments.length, // Skip cho lần sau
        total: totalComments,
      },
    });
  } catch (error) {
    next(error);
  }
};
