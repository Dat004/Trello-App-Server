// modules/upload/upload.controller.js
const uploadService = require('./upload.service');

exports.getUploadSignature = async (req, res, next) => {
  try {
    const { intent, contextId } = req.body;

    const data = uploadService.generateUploadSignature({
      intent,
      contextId,
      user: req.user,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
