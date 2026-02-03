class YouTubeDashboard {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.currentSection = 'overview';
        this.chart = null;
        
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
        // Auth forms
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        
        // Add video form
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

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showAlert(message, type = 'error') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        this.showLoading();
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
                this.showAlert('Login successful!', 'success');
            } else {
                this.showAlert(data.message);
            }
        } catch (error) {
            this.showAlert('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        this.showLoading();
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
                this.showAlert('Registration successful!', 'success');
            } else {
                this.showAlert(data.message);
            }
        } catch (error) {
            this.showAlert('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async handleAddVideo(e) {
        e.preventDefault();
        
        const videoUrl = document.getElementById('videoUrl').value;
        
        this.showLoading();
        
        try {
            const response = await fetch('/api/videos/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ videoUrl })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showAlert('Video added successfully!', 'success');
                document.getElementById('videoUrl').value = '';
                this.loadDashboardData();
                this.showSection('my-videos');
            } else {
                this.showAlert(data.message);
            }
        } catch (error) {
            this.showAlert('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/analytics/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardStats(data);
                this.updateChart(data.videos);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateDashboardStats(data) {
        document.getElementById('totalVideos').textContent = data.totalVideos;
        document.getElementById('totalViews').textContent = this.formatNumber(data.totalViews);
        document.getElementById('totalLikes').textContent = this.formatNumber(data.totalLikes);
        document.getElementById('totalComments').textContent = this.formatNumber(data.totalComments);
    }

    updateChart(videos) {
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const labels = videos.map(v => v.title.substring(0, 20) + '...');
        const viewsData = videos.map(v => v.currentViews);
        const firstDayData = videos.map(v => v.firstDayViews);
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Current Views',
                    data: viewsData,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }, {
                    label: 'First Day Views',
                    data: firstDayData,
                    backgroundColor: 'rgba(255, 71, 87, 0.8)',
                    borderColor: 'rgba(255, 71, 87, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Video Performance Comparison'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    async loadMyVideos() {
        try {
            const response = await fetch('/api/videos/my-videos', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
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
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
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
            const firstDayStats = video.analytics[0] || {};
            
            return `
                <div class="video-card">
                    <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
                    <div class="video-info">
                        <h3 class="video-title">${video.title}</h3>
                        ${video.userId && video.userId.name ? `<div class="video-owner">By: ${video.userId.name}</div>` : ''}
                        <div class="video-stats">
                            <span><i class="fas fa-eye"></i> ${this.formatNumber(latestStats.views || 0)}</span>
                            <span><i class="fas fa-thumbs-up"></i> ${this.formatNumber(latestStats.likes || 0)}</span>
                            <span><i class="fas fa-comments"></i> ${this.formatNumber(latestStats.comments || 0)}</span>
                        </div>
                        <div class="video-stats">
                            <span>First Day: ${this.formatNumber(firstDayStats.views || 0)} views</span>
                            <span>Growth: ${this.calculateGrowth(firstDayStats.views || 0, latestStats.views || 0)}%</span>
                        </div>
                        ${showActions ? `
                            <div class="video-actions">
                                <button class="btn btn-primary" onclick="window.open('${video.url}', '_blank')">
                                    <i class="fas fa-external-link-alt"></i> View
                                </button>
                                <button class="btn btn-danger" onclick="app.deleteVideo('${video._id}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        ` : `
                            <div class="video-actions">
                                <button class="btn btn-primary" onclick="window.open('${video.url}', '_blank')">
                                    <i class="fas fa-external-link-alt"></i> View
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    async deleteVideo(videoId) {
        if (!confirm('Are you sure you want to delete this video?')) {
            return;
        }
        
        this.showLoading();
        
        try {
            const response = await fetch(`/api/videos/${videoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                this.showAlert('Video deleted successfully!', 'success');
                this.loadMyVideos();
                this.loadDashboardData();
            } else {
                const data = await response.json();
                this.showAlert(data.message);
            }
        } catch (error) {
            this.showAlert('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    calculateGrowth(initial, current) {
        if (initial === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - initial) / initial) * 100);
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.token = null;
        this.user = {};
        this.showAuthModal();
    }
}

// Global functions
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
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    document.getElementById(sectionName).classList.remove('hidden');
    
    // Update active nav item
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Load section data
    switch(sectionName) {
        case 'overview':
            app.loadDashboardData();
            break;
        case 'my-videos':
            app.loadMyVideos();
            break;
        case 'all-videos':
            app.loadAllVideos();
            break;
    }
}

function logout() {
    app.logout();
}

// Initialize app
const app = new YouTubeDashboard();