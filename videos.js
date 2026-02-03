const express = require('express');
const Video = require('../models/Video');
const { authenticateToken } = require('../middleware/auth');
const { getVideoInfo } = require('../services/youtubeService');

const router = express.Router();

// Add video
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const videoId = extractVideoId(videoUrl);
    
    if (!videoId) {
      return res.status(400).json({ message: 'Invalid YouTube URL' });
    }

    const existingVideo = await Video.findOne({ userId: req.userId, videoId });
    if (existingVideo) {
      return res.status(400).json({ message: 'Video already added' });
    }

    const videoInfo = await getVideoInfo(videoId);
    if (!videoInfo) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const video = new Video({
      userId: req.userId,
      videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      url: videoUrl,
      analytics: [{
        views: videoInfo.views,
        likes: videoInfo.likes,
        comments: videoInfo.comments
      }]
    });

    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user videos
router.get('/my-videos', authenticateToken, async (req, res) => {
  try {
    const videos = await Video.find({ userId: req.userId }).sort({ addedAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all videos (for viewing other users' videos)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const videos = await Video.find()
      .populate('userId', 'name email')
      .sort({ addedAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete video
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const video = await Video.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.userId 
    });
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

module.exports = router;