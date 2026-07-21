const crypto = require("crypto");

const RESET_TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_MINUTES = 30;

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createPasswordResetToken = () => {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const expiresInMinutes =
    Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES) ||
    DEFAULT_EXPIRY_MINUTES;

  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  };
};

module.exports = {
  createPasswordResetToken,
  hashResetToken,
};
