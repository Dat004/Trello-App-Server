const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || "").split(","),
]
  .map((value) => value?.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin) => {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) =>
  !origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin);

// CORS options
const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
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
// remain supported. Localhost / 127.0.0.1 any port is allowed in development for Vite + Playwright.
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const origin = req.get('origin');
  if (isAllowedOrigin(origin)) return next();

  const error = new Error('Nguồn yêu cầu không hợp lệ');
  error.statusCode = 403;
  next(error);
});

// Simple route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Trello Clone API is running!' });
});

module.exports = { app, corsOptions };
