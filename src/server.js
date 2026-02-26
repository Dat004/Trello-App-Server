const http = require('http');

const errorHandler = require('./middlewares/errorMiddleware');
const { app, corsOptions } = require('./app');
const connectDB = require('./config/db');
const socketIO = require('./socket');
const router = require('./routes');
const { initDueDateReminders } = require('./services/jobs/dueDateCron');

// Khởi tạo Cron Jobs
initDueDateReminders();

// Kết nối DB trước khi khởi động server
connectDB();

const PORT = process.env.PORT || 5000;

// Tạo HTTP Server
const server = http.createServer(app);

// Khởi tạo Socket.io
socketIO.init(server, corsOptions);

// Router init
router(app);

// Middleware xử lý lỗi
app.use(errorHandler);

// Khởi động server
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});