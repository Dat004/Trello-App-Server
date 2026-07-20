module.exports.UPLOAD_INTENTS = {
  avatar: {
    folder: (userId) => `users/${userId}/avatar`,
    resource_type: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    maxSizeMB: 2,
    transformation: "c_fill,w_300,h_300",
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
    allowedFormats: [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "txt",
      "mp4",
      "mov",
      "zip",
    ],
    maxSizeMB: 20,
  },
};
