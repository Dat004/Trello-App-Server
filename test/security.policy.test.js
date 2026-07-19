const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const PERMISSIONS = require("../src/permissions/definitions");
const { defineAbilitiesFor } = require("../src/permissions/policy");
const loadContext = require("../src/middlewares/contextMiddleware");
const Board = require("../src/models/Board.model");
const List = require("../src/models/List.model");
const Card = require("../src/models/Card.model");

const id = () => new mongoose.Types.ObjectId();

const makeContext = (role, overrides = {}) => {
    const userId = id();
    const workspaceId = id();
    const workspace = {
        _id: workspaceId,
        owner: id(),
        visibility: "private",
        permissions: {
            canCreateBoard: "admin_member",
            canInviteMember: "admin_member",
        },
        members: [{ user: userId, role }],
    };
    const board = {
        _id: id(),
        owner: id(),
        workspace: workspaceId,
        visibility: "workspace",
        members: [{ user: userId, role }],
        ...overrides,
    };
    return { user: { _id: userId }, context: { workspace, board } };
};

test("board viewer can read but cannot mutate nested resources", () => {
    const { user, context } = makeContext("viewer");
    context.comment = { author: user._id };
    const abilities = defineAbilitiesFor(user, context);

    assert.ok(abilities.includes(PERMISSIONS.BOARD.VIEW));
    assert.ok(abilities.includes(PERMISSIONS.CARD.VIEW));
    assert.ok(!abilities.includes(PERMISSIONS.LIST.UPDATE));
    assert.ok(!abilities.includes(PERMISSIONS.CARD.UPDATE));
    assert.ok(!abilities.includes(PERMISSIONS.COMMENT.CREATE));
    assert.ok(!abilities.includes(PERMISSIONS.COMMENT.DELETE));
    assert.ok(!abilities.includes(PERMISSIONS.ATTACHMENT.CREATE));
    assert.ok(!abilities.includes(PERMISSIONS.WORKSPACE.CREATE_BOARD));
    assert.ok(!abilities.includes(PERMISSIONS.WORKSPACE.INVITE));
});

test("board member retains nested-resource mutation permissions", () => {
    const { user, context } = makeContext("member");
    const abilities = defineAbilitiesFor(user, context);

    assert.ok(abilities.includes(PERMISSIONS.LIST.UPDATE));
    assert.ok(abilities.includes(PERMISSIONS.CARD.UPDATE));
    assert.ok(abilities.includes(PERMISSIONS.COMMENT.CREATE));
    assert.ok(abilities.includes(PERMISSIONS.ATTACHMENT.CREATE));
});

test("admin_member invite policy permits members", () => {
    const { user, context } = makeContext("member");
    const abilities = defineAbilitiesFor(user, { workspace: context.workspace });

    assert.ok(abilities.includes(PERMISSIONS.WORKSPACE.INVITE));
});

test("context loader binds card to both route list and board", async () => {
    const boardId = id();
    const listId = id();
    const cardId = id();
    const originalFinders = {
        board: Board.findOne,
        list: List.findOne,
        card: Card.findOne,
    };

    Board.findOne = async (query) => ({ _id: query._id, workspace: null });
    List.findOne = async (query) => {
        assert.equal(String(query.board), String(boardId));
        return { _id: query._id, board: boardId };
    };
    Card.findOne = async (query) => {
        assert.equal(String(query.board), String(boardId));
        assert.equal(String(query.list), String(listId));
        return { _id: query._id, board: boardId, list: listId };
    };

    try {
        const req = {
            params: {
                boardId: String(boardId),
                listId: String(listId),
                cardId: String(cardId),
            },
        };
        const error = await new Promise((resolve) => loadContext(req, {}, resolve));

        assert.equal(error, undefined);
        assert.equal(String(req.card._id), String(cardId));
    } finally {
        Board.findOne = originalFinders.board;
        List.findOne = originalFinders.list;
        Card.findOne = originalFinders.card;
    }
});
