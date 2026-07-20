const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Template = require("../src/models/Template.model");
const { INTENT_PERMISSION } = require("../src/services/uploadAuth");
const PERMISSIONS = require("../src/permissions/definitions");
const { UPLOAD_INTENTS } = require("../src/config/upload");

test("public template filter only includes active system templates", () => {
  assert.deepEqual(Template.PUBLIC_TEMPLATE_FILTER, {
    is_active: true,
    is_system: true,
  });
  assert.equal(Template.PUBLIC_TEMPLATE_SELECT, "-ai_metadata");
});

test("card upload intents map to write permissions", () => {
  assert.equal(
    INTENT_PERMISSION.card_attachment,
    PERMISSIONS.ATTACHMENT.CREATE
  );
  assert.equal(INTENT_PERMISSION.card_comments, PERMISSIONS.COMMENT.CREATE);
});

test("card_attachment intent declares allowed formats and size", () => {
  const config = UPLOAD_INTENTS.card_attachment;
  assert.ok(Array.isArray(config.allowedFormats));
  assert.ok(config.allowedFormats.includes("pdf"));
  assert.equal(config.maxSizeMB, 20);
  assert.equal(
    config.folder(new mongoose.Types.ObjectId("64b64c4f2f1b2c0012345678")),
    "cards/64b64c4f2f1b2c0012345678/attachments"
  );
});
