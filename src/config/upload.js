// modules/upload/upload.config.js
module.exports.UPLOAD_INTENTS = {
  avatar: {
    folder: (userId) => `users/${userId}/avatar`,
    resource_type: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    maxSizeMB: 2,
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },

  card_comments: {
    folder: (cardId) => `cards/${cardId}/comments`,
    resource_type: "auto",
    allowedFormats: ["jpg", "png", "pdf", "doc", "docx", "xls", "xlsx", "mp4"],
    maxSizeMB: 20,
  },

  card_attachment: {
    folder: (cardId) => `cards/${cardId}/attachments`,
    resource_type: "auto",
    maxSizeMB: 20,
  },
};
