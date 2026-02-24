const { getIO } = require("../socket");

const emitToRoom = ({ room, event, data, socketId }) => {
    const io = getIO();

    if (socketId) {
        const senderSocket = io.sockets.sockets.get(socketId);
        if (senderSocket) {
            senderSocket.to(room).emit(event, data);
        } else {
            io.to(room).emit(event, data);
        }
    } else {
        io.to(room).emit(event, data);
    }
};

const isUserOnline = (userId) => {
    try {
        const io = getIO();
        const roomName = `user:${userId}`;

        // Kiểm tra xem room này có ai không
        const room = io.sockets.adapter.rooms.get(roomName);
        return room && room.size > 0;
    } catch (error) {
        return false;
    }
};

module.exports = { emitToRoom, isUserOnline };
