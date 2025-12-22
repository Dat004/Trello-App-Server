const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON request bodies
app.use(morgan('dev')); // HTTP request logger
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Simple route for testing
app.get('/', (req, res) => {
    res.json({ message: 'Trello Clone API is running!' });
});

module.exports = app;
