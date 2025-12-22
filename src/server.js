const app = require('./app');
const router = require('./routes');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorMiddleware');

// Kết nối DB trước khi khởi động server
connectDB();

const PORT = process.env.PORT || 5000;

// Router init
router(app);

// Middleware xử lý lỗi
app.use(errorHandler);

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});