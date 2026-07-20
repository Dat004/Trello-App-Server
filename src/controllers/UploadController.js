const uploadService = require("../services/upload.js");
const { resolveUploadContext } = require("../services/uploadAuth");

module.exports.getUploadSignature = async (req, res, next) => {
  try {
    const { intent, contextId } = req.body;

    const resolved = await resolveUploadContext({
      intent,
      contextId,
      user: req.user,
    });

    const data = uploadService.generateUploadSignature({
      intent: resolved.intent,
      contextId: resolved.contextId,
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
