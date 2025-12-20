const app = require('./app');
const connectDB = require('./config/db');

// Kết nối DB trước khi khởi động server
connectDB();

const PORT = process.env.PORT || 5000;

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});