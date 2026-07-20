const test = require("node:test");
const assert = require("node:assert/strict");

const {
  projectBoardForViewer,
  projectWorkspaceForViewer,
  sanitizeUser,
} = require("../src/dto/privacy");

test("sanitizeUser strips email by default", () => {
  const result = sanitizeUser({
    _id: "u1",
    full_name: "Ada",
    email: "ada@example.com",
    avatar: { url: "a.png" },
  });

  assert.equal(result.email, undefined);
  assert.equal(result.full_name, "Ada");
  assert.equal(result._id, "u1");
});

test("board projection hides admin fields and emails for non-admins", () => {
  const projected = projectBoardForViewer(
    {
      _id: "b1",
      title: "Board",
      invites: [{ email: "secret@example.com" }],
      join_requests: [
        {
          status: "pending",
          user: { _id: "u2", full_name: "Bob", email: "bob@example.com" },
        },
      ],
      members: [
        {
          role: "member",
          user: { _id: "u1", full_name: "Ada", email: "ada@example.com" },
        },
      ],
      lists: [
        {
          _id: "l1",
          cards: [
            {
              _id: "c1",
              members: [
                { _id: "u1", full_name: "Ada", email: "ada@example.com" },
              ],
            },
          ],
        },
      ],
    },
    { includeEmails: false, includeAdminFields: false }
  );

  assert.equal(projected.invites, undefined);
  assert.equal(projected.join_requests, undefined);
  assert.equal(projected.members[0].user.email, undefined);
  assert.equal(projected.lists[0].cards[0].members[0].email, undefined);
});

test("board projection keeps emails and join requests for managers", () => {
  const projected = projectBoardForViewer(
    {
      members: [
        {
          role: "admin",
          user: { _id: "u1", full_name: "Ada", email: "ada@example.com" },
        },
      ],
      join_requests: [
        {
          status: "pending",
          user: { _id: "u2", full_name: "Bob", email: "bob@example.com" },
        },
      ],
      invites: [{ email: "invite@example.com" }],
    },
    { includeEmails: true, includeAdminFields: true }
  );

  assert.equal(projected.members[0].user.email, "ada@example.com");
  assert.equal(projected.join_requests[0].user.email, "bob@example.com");
  assert.equal(projected.invites.length, 1);
});

test("workspace projection strips guest-sensitive fields", () => {
  const projected = projectWorkspaceForViewer(
    {
      name: "Public WS",
      owner: { _id: "o1", full_name: "Owner", email: "owner@example.com" },
      members: [
        {
          role: "member",
          user: { _id: "u1", full_name: "Ada", email: "ada@example.com" },
        },
      ],
      invites: [{ email: "x@example.com" }],
      join_requests: [
        {
          user: { _id: "u2", full_name: "Bob", email: "bob@example.com" },
        },
      ],
    },
    { includeEmails: false, includeAdminFields: false }
  );

  assert.equal(projected.owner.email, undefined);
  assert.equal(projected.members[0].user.email, undefined);
  assert.equal(projected.invites, undefined);
  assert.equal(projected.join_requests, undefined);
});
