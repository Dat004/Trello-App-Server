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
