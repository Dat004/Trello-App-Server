const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// CORS options
const corsOptions = {
  origin: process.env.CLIENT_URL,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization", "x-socket-id"],
  credentials: true,
  optionsSuccessStatus: 204,
};

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // Security headers
app.use(express.json()); // Parse JSON request bodies
app.use(morgan('dev')); // HTTP request logger
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(cookieParser()); // Parse cookies

// Cookie authentication needs an explicit cross-site request check in production
// (the auth cookie uses SameSite=None there). Non-browser clients without Origin
// remain supported.
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const origin = req.get('origin');
  if (!origin || origin === process.env.CLIENT_URL) return next();

  const error = new Error('Nguồn yêu cầu không hợp lệ');
  error.statusCode = 403;
  next(error);
});

// Simple route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Trello Clone API is running!' });
});

module.exports = { app, corsOptions };
