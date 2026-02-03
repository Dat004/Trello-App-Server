const { Server } = require("socket.io");

let io;

module.exports = {
    init: (httpServer, corsOptions) => {
        io = new Server(httpServer, {
            cors: corsOptions,
        });

        io.on("connection", (socket) => {
            console.log("Client connected:", socket.id);

            // Join room for specific card
            socket.on("join-card", (cardId) => {
                socket.join(`card:${cardId}`);
                console.log(`Socket ${socket.id} joined card room: card:${cardId}`);
            });

            // Leave room
            socket.on("leave-card", (cardId) => {
                socket.leave(`card:${cardId}`);
                console.log(`Socket ${socket.id} left card room: card:${cardId}`);
            });

            // Join room for specific board
            socket.on("join-board", (boardId) => {
                socket.join(`board:${boardId}`);
                console.log(`Socket ${socket.id} joined board room: board:${boardId}`);
            });

            // Leave board room
            socket.on("leave-board", (boardId) => {
                socket.leave(`board:${boardId}`);
                console.log(`Socket ${socket.id} left board room: board:${boardId}`);
            });

            // Join workspace room
            socket.on("join-workspace", (workspaceId) => {
                socket.join(`workspace:${workspaceId}`);
                console.log(`Socket ${socket.id} joined workspace room: workspace:${workspaceId}`);
            });

            // Leave workspace room
            socket.on("leave-workspace", (workspaceId) => {
                socket.leave(`workspace:${workspaceId}`);
                console.log(`Socket ${socket.id} left workspace room: workspace:${workspaceId}`);
            });

            socket.on("disconnect", () => {
                console.log("Client disconnected:", socket.id);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
};
