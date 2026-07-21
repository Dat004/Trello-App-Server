const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../src/models/User.model");
const {
  createPasswordResetToken,
  hashResetToken,
} = require("../src/services/auth/passwordReset");
const {
  resetPasswordSchema,
  changePasswordSchema,
} = require("../src/utils/validationSchemas");

test("password reset token stores a hash and future expiry", () => {
  const before = Date.now();
  const { token, tokenHash, expiresAt } = createPasswordResetToken();

  assert.equal(token.length, 64);
  assert.notEqual(token, tokenHash);
  assert.equal(hashResetToken(token), tokenHash);
  assert.ok(expiresAt.getTime() > before);
});

test("reset password schema rejects weak and mismatched passwords", () => {
  assert.equal(
    resetPasswordSchema.safeParse({
      token: "a".repeat(64),
      password: "weakpass",
      confirmPassword: "weakpass",
    }).success,
    false
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: "a".repeat(64),
      password: "StrongPass1",
      confirmPassword: "DifferentPass1",
    }).success,
    false
  );
});

test("change password schema accepts a strong matching password", () => {
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: "Demo123!",
      password: "NewDemo456!",
      confirmPassword: "NewDemo456!",
    }).success,
    true
  );
});

test("invalidating sessions increments auth version", () => {
  const user = new User({
    full_name: "Password Test",
    email: "password-test@example.com",
    providers: ["password"],
  });

  assert.equal(user.auth_version, 0);
  user.invalidateSessions();
  assert.equal(user.auth_version, 1);
});
