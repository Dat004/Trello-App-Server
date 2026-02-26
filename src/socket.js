const { Server } = require("socket.io");

let io;

module.exports = {
    init: (httpServer, corsOptions) => {
        io = new Server(httpServer, {
            cors: corsOptions,
        });

        // In-memory trackers
        const activeUsers = new Map(); // socket.id -> { user, boardId, cardId }
        const fieldLocks = new Map(); // `${cardId}:${field}` -> user info

        io.on("connection", (socket) => {
            console.log("Client connected:", socket.id);

            // --- PRESENCE & USER REGISTRATION ---
            socket.on("register-user", (user) => {
                activeUsers.set(socket.id, { user, rooms: new Set() });
            });

            // --- BOARD PRESENCE ---
            socket.on("join-board", (boardId) => {
                socket.join(`board:${boardId}`);

                const userData = activeUsers.get(socket.id);
                if (userData) {
                    userData.boardId = boardId;
                    userData.rooms.add(`board:${boardId}`);

                    // Broadcast updated presence to the board
                    const boardPresence = getRoomPresence(io, `board:${boardId}`, activeUsers);
                    io.to(`board:${boardId}`).emit("board-presence-update", {
                        boardId,
                        members: boardPresence
                    });
                }
                console.log(`Socket ${socket.id} joined board: board:${boardId}`);
            });

            socket.on("leave-board", (boardId) => {
                handleLeaveRoom(socket, `board:${boardId}`, "board-presence-update", { boardId }, activeUsers, io);
            });

            // --- CARD PRESENCE ---
            socket.on("join-card", (cardId) => {
                socket.join(`card:${cardId}`);

                const userData = activeUsers.get(socket.id);
                if (userData) {
                    userData.cardId = cardId;
                    userData.rooms.add(`card:${cardId}`);

                    // Broadcast updated presence to the card
                    const cardPresence = getRoomPresence(io, `card:${cardId}`, activeUsers);
                    io.to(`card:${cardId}`).emit("card-presence-update", {
                        cardId,
                        members: cardPresence
                    });

                    // Send current locks on this card to the newcomer
                    const currentLocks = Array.from(fieldLocks.entries())
                        .filter(([key]) => key.startsWith(`${cardId}:`))
                        .map(([key, user]) => ({ field: key.split(":")[1], user }));

                    socket.emit("card-locks-init", { cardId, locks: currentLocks });
                }
            });

            socket.on("leave-card", (cardId) => {
                handleLeaveRoom(socket, `card:${cardId}`, "card-presence-update", { cardId }, activeUsers, io);

                // Release locks held by this user on this card
                releaseUserLocks(socket.id, cardId, fieldLocks, io);
            });

            // --- TYPING INDICATOR ---
            socket.on("card-typing-start", ({ cardId, user }) => {
                socket.to(`card:${cardId}`).emit("card-typing-update", {
                    cardId,
                    user,
                    isTyping: true
                });
            });

            socket.on("card-typing-stop", ({ cardId, user }) => {
                socket.to(`card:${cardId}`).emit("card-typing-update", {
                    cardId,
                    user,
                    isTyping: false
                });
            });

            // --- FIELD LOCKING ---
            socket.on("card-field-lock", ({ cardId, field, user }) => {
                const lockKey = `${cardId}:${field}`;
                if (!fieldLocks.has(lockKey)) {
                    fieldLocks.set(lockKey, { ...user, socketId: socket.id });
                    io.to(`card:${cardId}`).emit("card-field-locked", {
                        cardId,
                        field,
                        user
                    });
                } else {
                    // Alert the user that the field is already locked
                    socket.emit("card-field-lock-failed", { cardId, field, lockedBy: fieldLocks.get(lockKey) });
                }
            });

            socket.on("card-field-unlock", ({ cardId, field }) => {
                const lockKey = `${cardId}:${field}`;
                const lock = fieldLocks.get(lockKey);
                if (lock && lock.socketId === socket.id) {
                    fieldLocks.delete(lockKey);
                    io.to(`card:${cardId}`).emit("card-field-unlocked", {
                        cardId,
                        field
                    });
                }
            });

            // --- NOTIFICATIONS ---
            socket.on("join-user", (userId) => {
                socket.join(`user:${userId}`);
            });

            socket.on("disconnect", () => {
                const userData = activeUsers.get(socket.id);
                if (userData) {
                    // Update presence in all rooms this socket was in
                    userData.rooms.forEach(room => {
                        socket.leave(room);
                        const [type, id] = room.split(":");
                        const event = type === "board" ? "board-presence-update" : "card-presence-update";
                        const presence = getRoomPresence(io, room, activeUsers, socket.id);

                        io.to(room).emit(event, {
                            [type === "board" ? "boardId" : "cardId"]: id,
                            members: presence
                        });
                    });

                    // Release all locks held by this socket
                    releaseAllUserLocks(socket.id, fieldLocks, io);
                    activeUsers.delete(socket.id);
                }
                console.log("Client disconnected:", socket.id);
            });
        });

        // --- HELPER FUNCTIONS ---
        function getRoomPresence(io, room, activeUsers, excludeSocketId = null) {
            const socketsInRoom = io.sockets.adapter.rooms.get(room);
            if (!socketsInRoom) return [];

            const members = [];
            const seenUsers = new Set();

            for (const socketId of socketsInRoom) {
                if (socketId === excludeSocketId) continue;
                const data = activeUsers.get(socketId);
                if (data && data.user && !seenUsers.has(data.user._id)) {
                    members.push(data.user);
                    seenUsers.add(data.user._id);
                }
            }
            return members;
        }

        function handleLeaveRoom(socket, room, event, payload, activeUsers, io) {
            socket.leave(room);
            const userData = activeUsers.get(socket.id);
            if (userData) {
                userData.rooms.delete(room);
                const presence = getRoomPresence(io, room, activeUsers);
                io.to(room).emit(event, { ...payload, members: presence });
            }
        }

        function releaseUserLocks(socketId, cardId, fieldLocks, io) {
            for (const [key, lock] of fieldLocks.entries()) {
                if (key.startsWith(`${cardId}:`) && lock.socketId === socketId) {
                    fieldLocks.delete(key);
                    const field = key.split(":")[1];
                    io.to(`card:${cardId}`).emit("card-field-unlocked", { cardId, field });
                }
            }
        }

        function releaseAllUserLocks(socketId, fieldLocks, io) {
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
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
};
