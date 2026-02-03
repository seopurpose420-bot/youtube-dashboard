const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

// Video Schema
const videoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String, required: true },
  url: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  analytics: [{
    date: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
  }]
});

const Video = mongoose.model('Video', videoSchema);

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    const user = new User({ email, password, name });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret');
    res.status(201).json({ token, user: { id: user._id, email, name } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret');
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Video routes
app.post('/api/videos/add', authenticateToken, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
    if (!videoId) return res.status(400).json({ message: 'Invalid YouTube URL' });
    
    const existingVideo = await Video.findOne({ userId: req.userId, videoId });
    if (existingVideo) return res.status(400).json({ message: 'Video already added' });
    
    const video = new Video({
      userId: req.userId,
      videoId,
      title: 'YouTube Video',
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      url: videoUrl,
      analytics: [{ views: 0, likes: 0, comments: 0 }]
    });
    
    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/videos/my-videos', authenticateToken, async (req, res) => {
  try {
    const videos = await Video.find({ userId: req.userId }).sort({ addedAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/videos/all', authenticateToken, async (req, res) => {
  try {
    const videos = await Video.find().populate('userId', 'name email').sort({ addedAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.delete('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    const video = await Video.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Analytics routes
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
    const videos = await Video.find({ userId: req.userId });
    const totalVideos = videos.length;
    let totalViews = 0, totalLikes = 0, totalComments = 0;
    
    videos.forEach(video => {
      if (video.analytics.length > 0) {
        const latest = video.analytics[video.analytics.length - 1];
        totalViews += latest.views;
        totalLikes += latest.likes;
        totalComments += latest.comments;
      }
    });
    
    res.json({
      totalVideos, totalViews, totalLikes, totalComments,
      videos: videos.map(video => ({
        id: video._id, title: video.title, thumbnail: video.thumbnail,
        currentViews: video.analytics.length > 0 ? video.analytics[video.analytics.length - 1].views : 0,
        firstDayViews: video.analytics.length > 0 ? video.analytics[0].views : 0,
        addedAt: video.addedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Main dashboard route
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube Analytics Dashboard</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .hidden { display: none !important; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); width: 90%; max-width: 400px; }
        .auth-tabs { display: flex; margin-bottom: 2rem; border-radius: 8px; overflow: hidden; background: #f5f5f5; }
        .tab-btn { flex: 1; padding: 12px; border: none; background: transparent; cursor: pointer; font-weight: 600; transition: all 0.3s; }
        .tab-btn.active { background: #667eea; color: white; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .auth-form h2 { margin-bottom: 1rem; color: #333; text-align: center; }
        .auth-form input { padding: 12px; border: 2px solid #e1e1e1; border-radius: 8px; font-size: 16px; }
        .auth-form button { padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
        .navbar { background: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); }
        .nav-brand { font-size: 1.5rem; font-weight: bold; color: #667eea; }
        .nav-user { display: flex; align-items: center; gap: 1rem; }
        .logout-btn { background: #ff4757; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
        .main-content { padding: 2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); display: flex; align-items: center; gap: 1rem; }
        .stat-card i { font-size: 2.5rem; color: #667eea; }
        .stat-info h3 { font-size: 2rem; color: #333; margin-bottom: 0.5rem; }
        .stat-info p { color: #666; font-size: 0.9rem; }
        .videos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .video-card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); }
        .video-thumbnail { width: 100%; height: 200px; object-fit: cover; }
        .video-info { padding: 1.5rem; }
        .video-title { font-size: 1.1rem; font-weight: 600; color: #333; margin-bottom: 1rem; }
        .video-stats { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
        .add-video-form { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); max-width: 500px; display: flex; gap: 1rem; }
        .add-video-form input { flex: 1; padding: 12px; border: 2px solid #e1e1e1; border-radius: 8px; font-size: 16px; }
        .add-video-form button { padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; margin: 2px; }
        .btn-primary { background: #667eea; color: white; }
        .btn-danger { background: #ff4757; color: white; }
        .section-nav { background: white; padding: 1rem; border-radius: 10px; margin-bottom: 2rem; }
        .section-nav button { margin-right: 1rem; padding: 10px 20px; border: none; background: #f5f5f5; border-radius: 6px; cursor: pointer; }
        .section-nav button.active { background: #667eea; color: white; }
        h1 { color: white; margin-bottom: 2rem; }
    </style>
</head>
<body>
    <div id="authModal" class="modal">
        <div class="modal-content">
            <div class="auth-tabs">
                <button class="tab-btn active" onclick="showLogin()">Login</button>
                <button class="tab-btn" onclick="showRegister()">Register</button>
            </div>
            <form id="loginForm" class="auth-form">
                <h2>Welcome Back</h2>
                <input type="email" id="loginEmail" placeholder="Email" required>
                <input type="password" id="loginPassword" placeholder="Password" required>
                <button type="submit">Login</button>
            </form>
            <form id="registerForm" class="auth-form hidden">
                <h2>Create Account</h2>
                <input type="text" id="registerName" placeholder="Full Name" required>
                <input type="email" id="registerEmail" placeholder="Email" required>
                <input type="password" id="registerPassword" placeholder="Password" required>
                <button type="submit">Register</button>
            </form>
        </div>
    </div>
    
    <div id="dashboard" class="hidden">
        <nav class="navbar">
            <div class="nav-brand"><i class="fab fa-youtube"></i> YouTube Analytics</div>
            <div class="nav-user">
                <span id="userName"></span>
                <button onclick="logout()" class="logout-btn"><i class="fas fa-sign-out-alt"></i></button>
            </div>
        </nav>
        
        <main class="main-content">
            <div class="section-nav">
                <button class="active" onclick="showSection('overview')">Overview</button>
                <button onclick="showSection('my-videos')">My Videos</button>
                <button onclick="showSection('all-videos')">All Videos</button>
                <button onclick="showSection('add-video')">Add Video</button>
            </div>
            
            <section id="overview">
                <h1>Dashboard Overview</h1>
                <div class="stats-grid">
                    <div class="stat-card">
                        <i class="fas fa-video"></i>
                        <div class="stat-info">
                            <h3 id="totalVideos">0</h3>
                            <p>Total Videos</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-eye"></i>
                        <div class="stat-info">
                            <h3 id="totalViews">0</h3>
                            <p>Total Views</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-thumbs-up"></i>
                        <div class="stat-info">
                            <h3 id="totalLikes">0</h3>
                            <p>Total Likes</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-comments"></i>
                        <div class="stat-info">
                            <h3 id="totalComments">0</h3>
                            <p>Total Comments</p>
                        </div>
                    </div>
                </div>
            </section>
            
            <section id="my-videos" class="hidden">
                <h1>My Videos</h1>
                <div id="myVideosList" class="videos-grid"></div>
            </section>
            
            <section id="all-videos" class="hidden">
                <h1>All Users Videos</h1>
                <div id="allVideosList" class="videos-grid"></div>
            </section>
            
            <section id="add-video" class="hidden">
                <h1>Add New Video</h1>
                <form id="addVideoForm" class="add-video-form">
                    <input type="url" id="videoUrl" placeholder="YouTube Video URL" required>
                    <button type="submit">Add Video</button>
                </form>
            </section>
        </main>
    </div>
    
    <script>
        class YouTubeDashboard {
            constructor() {
                this.token = localStorage.getItem('token');
                this.user = JSON.parse(localStorage.getItem('user') || '{}');
                this.init();
            }
            
            init() {
                if (this.token) {
                    this.showDashboard();
                    this.loadDashboardData();
                } else {
                    this.showAuthModal();
                }
                this.bindEvents();
            }
            
            bindEvents() {
                document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
                document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
                document.getElementById('addVideoForm').addEventListener('submit', (e) => this.handleAddVideo(e));
            }
            
            showAuthModal() {
                document.getElementById('authModal').classList.remove('hidden');
                document.getElementById('dashboard').classList.add('hidden');
            }
            
            showDashboard() {
                document.getElementById('authModal').classList.add('hidden');
                document.getElementById('dashboard').classList.remove('hidden');
                document.getElementById('userName').textContent = this.user.name || this.user.email;
            }
            
            async handleLogin(e) {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                
                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                        this.token = data.token;
                        this.user = data.user;
                        localStorage.setItem('token', this.token);
                        localStorage.setItem('user', JSON.stringify(this.user));
                        this.showDashboard();
                        this.loadDashboardData();
                    } else {
                        alert(data.message);
                    }
                } catch (error) {
                    alert('Network error. Please try again.');
                }
            }
            
            async handleRegister(e) {
                e.preventDefault();
                const name = document.getElementById('registerName').value;
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                
                try {
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                        this.token = data.token;
                        this.user = data.user;
                        localStorage.setItem('token', this.token);
                        localStorage.setItem('user', JSON.stringify(this.user));
                        this.showDashboard();
                        this.loadDashboardData();
                    } else {
                        alert(data.message);
                    }
                } catch (error) {
                    alert('Network error. Please try again.');
                }
            }
            
            async handleAddVideo(e) {
                e.preventDefault();
                const videoUrl = document.getElementById('videoUrl').value;
                
                try {
                    const response = await fetch('/api/videos/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${this.token}\`
                        },
                        body: JSON.stringify({ videoUrl })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                        alert('Video added successfully!');
                        document.getElementById('videoUrl').value = '';
                        this.loadDashboardData();
                        showSection('my-videos');
                    } else {
                        alert(data.message);
                    }
                } catch (error) {
                    alert('Network error. Please try again.');
                }
            }
            
            async loadDashboardData() {
                try {
                    const response = await fetch('/api/analytics/dashboard', {
                        headers: { 'Authorization': \`Bearer \${this.token}\` }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        document.getElementById('totalVideos').textContent = data.totalVideos;
                        document.getElementById('totalViews').textContent = data.totalViews;
                        document.getElementById('totalLikes').textContent = data.totalLikes;
                        document.getElementById('totalComments').textContent = data.totalComments;
                    }
                } catch (error) {
                    console.error('Error loading dashboard data:', error);
                }
            }
            
            async loadMyVideos() {
                try {
                    const response = await fetch('/api/videos/my-videos', {
                        headers: { 'Authorization': \`Bearer \${this.token}\` }
                    });
                    
                    if (response.ok) {
                        const videos = await response.json();
                        this.renderVideos(videos, 'myVideosList', true);
                    }
                } catch (error) {
                    console.error('Error loading my videos:', error);
                }
            }
            
            async loadAllVideos() {
                try {
                    const response = await fetch('/api/videos/all', {
                        headers: { 'Authorization': \`Bearer \${this.token}\` }
                    });
                    
                    if (response.ok) {
                        const videos = await response.json();
                        this.renderVideos(videos, 'allVideosList', false);
                    }
                } catch (error) {
                    console.error('Error loading all videos:', error);
                }
            }
            
            renderVideos(videos, containerId, showActions = false) {
                const container = document.getElementById(containerId);
                
                if (videos.length === 0) {
                    container.innerHTML = '<p style="color: white; text-align: center;">No videos found.</p>';
                    return;
                }
                
                container.innerHTML = videos.map(video => {
                    const latestStats = video.analytics[video.analytics.length - 1] || {};
                    return \`
                        <div class="video-card">
                            <img src="\${video.thumbnail}" alt="\${video.title}" class="video-thumbnail">
                            <div class="video-info">
                                <h3 class="video-title">\${video.title}</h3>
                                \${video.userId && video.userId.name ? \`<div style="font-size: 0.8rem; color: #999; margin-bottom: 1rem;">By: \${video.userId.name}</div>\` : ''}
                                <div class="video-stats">
                                    <span><i class="fas fa-eye"></i> \${latestStats.views || 0}</span>
                                    <span><i class="fas fa-thumbs-up"></i> \${latestStats.likes || 0}</span>
                                    <span><i class="fas fa-comments"></i> \${latestStats.comments || 0}</span>
                                </div>
                                <div style="margin-top: 1rem;">
                                    <button class="btn btn-primary" onclick="window.open('\${video.url}', '_blank')">
                                        <i class="fas fa-external-link-alt"></i> View
                                    </button>
                                    \${showActions ? \`<button class="btn btn-danger" onclick="app.deleteVideo('\${video._id}')"><i class="fas fa-trash"></i> Delete</button>\` : ''}
                                </div>
                            </div>
                        </div>
                    \`;
                }).join('');
            }
            
            async deleteVideo(videoId) {
                if (!confirm('Are you sure you want to delete this video?')) return;
                
                try {
                    const response = await fetch(\`/api/videos/\${videoId}\`, {
                        method: 'DELETE',
                        headers: { 'Authorization': \`Bearer \${this.token}\` }
                    });
                    
                    if (response.ok) {
                        alert('Video deleted successfully!');
                        this.loadMyVideos();
                        this.loadDashboardData();
                    } else {
                        const data = await response.json();
                        alert(data.message);
                    }
                } catch (error) {
                    alert('Network error. Please try again.');
                }
            }
            
            logout() {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                this.token = null;
                this.user = {};
                this.showAuthModal();
            }
        }
        
        function showLogin() {
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.querySelectorAll('.tab-btn')[0].classList.add('active');
            document.querySelectorAll('.tab-btn')[1].classList.remove('active');
        }
        
        function showRegister() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            document.querySelectorAll('.tab-btn')[0].classList.remove('active');
            document.querySelectorAll('.tab-btn')[1].classList.add('active');
        }
        
        function showSection(sectionName) {
            document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
            document.getElementById(sectionName).classList.remove('hidden');
            
            document.querySelectorAll('.section-nav button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            switch(sectionName) {
                case 'overview': app.loadDashboardData(); break;
                case 'my-videos': app.loadMyVideos(); break;
                case 'all-videos': app.loadAllVideos(); break;
            }
        }
        
        function logout() { app.logout(); }
        
        const app = new YouTubeDashboard();
    </script>
</body>
</html>`);
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
