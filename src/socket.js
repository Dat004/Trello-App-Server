const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("./models/User.model");
const Workspace = require("./models/Workspace.model");
const Board = require("./models/Board.model");
const Card = require("./models/Card.model");
const PERMISSIONS = require("./permissions/definitions");
const { defineAbilitiesFor } = require("./permissions/policy");

let io;

const parseCookies = (header = "") =>
    header.split(";").reduce((cookies, part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return cookies;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);
        return cookies;
    }, {});

const publicUser = (user) => ({
    _id: user._id,
    full_name: user.full_name,
    email: user.email,
    avatar: user.avatar,
});

const can = (user, context, permission) =>
    defineAbilitiesFor(user, context).includes(permission);

module.exports = {
    init: (httpServer, corsOptions) => {
        io = new Server(httpServer, { cors: corsOptions });

        const activeUsers = new Map();
        const fieldLocks = new Map();

        io.use(async (socket, next) => {
            try {
                const token = parseCookies(socket.handshake.headers.cookie).token;
                if (!token) return next(new Error("Unauthorized"));

                const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                    algorithms: ["HS256"],
                    issuer: "trello-api",
                });
                const user = await User.findById(decoded.sub);
                if (!user) return next(new Error("Unauthorized"));

                socket.user = user;
                next();
            } catch (_error) {
                next(new Error("Unauthorized"));
            }
        });

        io.on("connection", (socket) => {
            const trustedUser = publicUser(socket.user);
            activeUsers.set(socket.id, {
                user: trustedUser,
                rooms: new Set(),
                writableCardRooms: new Set(),
            });

            const fail = (message = "Bạn không có quyền tham gia room này") => {
                socket.emit("socket-error", { message });
            };

            const loadWorkspaceContext = async (workspaceId) => {
                const workspace = await Workspace.findOne({ _id: workspaceId, deleted_at: null });
                return workspace ? { workspace } : null;
            };

            const loadBoardContext = async (boardId) => {
                const board = await Board.findOne({ _id: boardId, deleted_at: null });
                if (!board) return null;
                const workspace = board.workspace
                    ? await Workspace.findOne({ _id: board.workspace, deleted_at: null })
                    : null;
                return { board, ...(workspace ? { workspace } : {}) };
            };

            const loadCardContext = async (cardId) => {
                const card = await Card.findOne({ _id: cardId, deleted_at: null });
                if (!card) return null;
                const boardContext = await loadBoardContext(card.board);
                return boardContext ? { ...boardContext, card } : null;
            };

            // Kept for client compatibility; supplied user data is intentionally ignored.
            socket.on("register-user", () => {
                socket.emit("user-registered", trustedUser);
            });

            socket.on("join-user", (userId) => {
                if (String(userId) !== String(socket.user._id)) return fail();
                socket.join(`user:${socket.user._id}`);
            });

            socket.on("join-workspace", async (workspaceId) => {
                try {
                    const context = await loadWorkspaceContext(workspaceId);
                    if (!context || !can(socket.user, context, PERMISSIONS.WORKSPACE.VIEW)) return fail();

                    const room = `workspace:${context.workspace._id}`;
                    socket.join(room);
                    activeUsers.get(socket.id).rooms.add(room);
                    emitPresence(room, "workspace-presence-update", {
                        workspaceId: String(context.workspace._id),
                    });
                } catch (_error) {
                    fail("Workspace không hợp lệ");
                }
            });

            socket.on("leave-workspace", (workspaceId) => {
                leaveRoom(`workspace:${workspaceId}`, "workspace-presence-update", { workspaceId });
            });

            socket.on("join-board", async (boardId) => {
                try {
                    const context = await loadBoardContext(boardId);
                    if (!context || !can(socket.user, context, PERMISSIONS.BOARD.VIEW)) return fail();

                    const room = `board:${context.board._id}`;
                    socket.join(room);
                    activeUsers.get(socket.id).rooms.add(room);
                    emitPresence(room, "board-presence-update", {
                        boardId: String(context.board._id),
                    });
                } catch (_error) {
                    fail("Board không hợp lệ");
                }
            });

            socket.on("leave-board", (boardId) => {
                leaveRoom(`board:${boardId}`, "board-presence-update", { boardId });
            });

            socket.on("join-card", async (cardId) => {
                try {
                    const context = await loadCardContext(cardId);
                    if (!context || !can(socket.user, context, PERMISSIONS.CARD.VIEW)) return fail();

                    const room = `card:${context.card._id}`;
                    const userData = activeUsers.get(socket.id);
                    socket.join(room);
                    userData.rooms.add(room);
                    if (can(socket.user, context, PERMISSIONS.CARD.UPDATE)) {
                        userData.writableCardRooms.add(room);
                    }

                    emitPresence(room, "card-presence-update", {
                        cardId: String(context.card._id),
                    });

                    const locks = Array.from(fieldLocks.entries())
                        .filter(([key]) => key.startsWith(`${context.card._id}:`))
                        .map(([key, user]) => ({ field: key.split(":")[1], user }));
                    socket.emit("card-locks-init", { cardId: String(context.card._id), locks });
                } catch (_error) {
                    fail("Card không hợp lệ");
                }
            });

            socket.on("leave-card", (cardId) => {
                const room = `card:${cardId}`;
                leaveRoom(room, "card-presence-update", { cardId });
                activeUsers.get(socket.id)?.writableCardRooms.delete(room);
                releaseUserLocks(socket.id, cardId);
            });

            socket.on("card-typing-start", ({ cardId } = {}) => {
                emitTyping(cardId, true);
            });

            socket.on("card-typing-stop", ({ cardId } = {}) => {
                emitTyping(cardId, false);
            });

            socket.on("card-field-lock", ({ cardId, field } = {}) => {
                const room = `card:${cardId}`;
                const userData = activeUsers.get(socket.id);
                if (!userData?.writableCardRooms.has(room)) return fail("Bạn chỉ có quyền đọc card này");
                if (typeof field !== "string" || !/^[a-zA-Z0-9_.-]{1,64}$/.test(field)) {
                    return fail("Field không hợp lệ");
                }

                const lockKey = `${cardId}:${field}`;
                if (!fieldLocks.has(lockKey)) {
                    fieldLocks.set(lockKey, { ...trustedUser, socketId: socket.id });
                    io.to(room).emit("card-field-locked", { cardId, field, user: trustedUser });
                } else {
                    socket.emit("card-field-lock-failed", {
                        cardId,
                        field,
                        lockedBy: fieldLocks.get(lockKey),
                    });
                }
            });

            socket.on("card-field-unlock", ({ cardId, field } = {}) => {
                const lockKey = `${cardId}:${field}`;
                const lock = fieldLocks.get(lockKey);
                if (lock && lock.socketId === socket.id) {
                    fieldLocks.delete(lockKey);
                    io.to(`card:${cardId}`).emit("card-field-unlocked", { cardId, field });
                }
            });

            socket.on("disconnect", () => {
                const userData = activeUsers.get(socket.id);
                if (userData) {
                    userData.rooms.forEach((room) => {
                        const [type, id] = room.split(":");
                        const event = type === "workspace"
                            ? "workspace-presence-update"
                            : type === "board"
                                ? "board-presence-update"
                                : "card-presence-update";
                        const idKey = `${type}Id`;
                        io.to(room).emit(event, {
                            [idKey]: id,
                            members: getRoomPresence(room, socket.id),
                        });
                    });
                }
                releaseAllUserLocks(socket.id);
                activeUsers.delete(socket.id);
            });

            function emitTyping(cardId, isTyping) {
                const room = `card:${cardId}`;
                if (!activeUsers.get(socket.id)?.rooms.has(room)) return fail();
                socket.to(room).emit("card-typing-update", {
                    cardId,
                    user: trustedUser,
                    isTyping,
                });
            }

            function emitPresence(room, event, payload) {
                io.to(room).emit(event, { ...payload, members: getRoomPresence(room) });
            }

            function leaveRoom(room, event, payload) {
                const userData = activeUsers.get(socket.id);
                if (!userData?.rooms.has(room)) return;
                socket.leave(room);
                userData.rooms.delete(room);
                io.to(room).emit(event, { ...payload, members: getRoomPresence(room) });
            }
        });

        function getRoomPresence(room, excludeSocketId = null) {
            const socketsInRoom = io.sockets.adapter.rooms.get(room);
            if (!socketsInRoom) return [];

            const members = [];
            const seenUsers = new Set();
            for (const socketId of socketsInRoom) {
                if (socketId === excludeSocketId) continue;
                const data = activeUsers.get(socketId);
                const userId = data?.user?._id && String(data.user._id);
                if (userId && !seenUsers.has(userId)) {
                    members.push(data.user);
                    seenUsers.add(userId);
                }
            }
            return members;
        }

        function releaseUserLocks(socketId, cardId) {
            for (const [key, lock] of fieldLocks.entries()) {
                if (key.startsWith(`${cardId}:`) && lock.socketId === socketId) {
                    fieldLocks.delete(key);
                    io.to(`card:${cardId}`).emit("card-field-unlocked", {
                        cardId,
                        field: key.split(":")[1],
                    });
                }
            }
        }

        function releaseAllUserLocks(socketId) {
            for (const [key, lock] of fieldLocks.entries()) {
                if (lock.socketId === socketId) {
                    fieldLocks.delete(key);
                    const [cardId, field] = key.split(":");
                    io.to(`card:${cardId}`).emit("card-field-unlocked", { cardId, field });
                }
            }
        }

        return io;
    },
    getIO: () => {
        if (!io) throw new Error("Socket.io not initialized!");
        return io;
    },
};
