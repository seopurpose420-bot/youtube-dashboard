const axios = require('axios');
const Video = require('../models/Video');

const getVideoInfo = async (videoId) => {
  try {
    const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
      params: {
        part: 'snippet,statistics',
        id: videoId,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    if (response.data.items.length === 0) {
      return null;
    }

    const video = response.data.items[0];
    return {
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.medium.url,
      views: parseInt(video.statistics.viewCount) || 0,
      likes: parseInt(video.statistics.likeCount) || 0,
      comments: parseInt(video.statistics.commentCount) || 0
    };
  } catch (error) {
    console.error('Error fetching video info:', error.message);
    return null;
  }
};

const updateVideoAnalytics = async () => {
  try {
    const videos = await Video.find();
    
    for (const video of videos) {
      const videoInfo = await getVideoInfo(video.videoId);
      if (videoInfo) {
        video.analytics.push({
          views: videoInfo.views,
          likes: videoInfo.likes,
          comments: videoInfo.comments
        });
        await video.save();
      }
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Updated analytics for ${videos.length} videos`);
  } catch (error) {
    console.error('Error updating video analytics:', error.message);
  }
};

module.exports = { getVideoInfo, updateVideoAnalytics };