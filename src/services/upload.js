// modules/upload/upload.service.js
const { UPLOAD_INTENTS } = require('../config/upload');
const cloudinary = require('../config/cloudinary');

exports.generateUploadSignature = ({ intent, user, contextId }) => {
  const config = UPLOAD_INTENTS[intent];
  if (!config) throw new Error('Invalid upload intent');

  const timestamp = Math.round(Date.now() / 1000);

  const params = {
    timestamp,
    folder: config.folder(contextId || user._id),
    resource_type: config.resource_type || 'auto',
    ...(config.transformation && {
      transformation: config.transformation
    }),
  };

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    params,
    constraints: {
      allowedFormats: config.allowedFormats,
      maxSizeMB: config.maxSizeMB,
    }
  };
};
