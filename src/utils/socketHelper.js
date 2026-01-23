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

module.exports = { emitToRoom };
