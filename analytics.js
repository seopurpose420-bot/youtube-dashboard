const express = require('express');
const Video = require('../models/Video');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get analytics for a specific video
router.get('/video/:id', authenticateToken, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const analytics = video.analytics.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user dashboard stats
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const videos = await Video.find({ userId: req.userId });
    
    const totalVideos = videos.length;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    videos.forEach(video => {
      if (video.analytics.length > 0) {
        const latest = video.analytics[video.analytics.length - 1];
        totalViews += latest.views;
        totalLikes += latest.likes;
        totalComments += latest.comments;
      }
    });

    res.json({
      totalVideos,
      totalViews,
      totalLikes,
      totalComments,
      videos: videos.map(video => ({
        id: video._id,
        title: video.title,
        thumbnail: video.thumbnail,
        currentViews: video.analytics.length > 0 ? video.analytics[video.analytics.length - 1].views : 0,
        firstDayViews: video.analytics.length > 0 ? video.analytics[0].views : 0,
        addedAt: video.addedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;