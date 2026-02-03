const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Basic routes without external files
app.get('/', (req, res) => {
  res.send('YouTube Dashboard Server Running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// MongoDB connection with fallback
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
