# YouTube Analytics Dashboard

A comprehensive web application for tracking YouTube video analytics with user authentication and real-time data updates.

## Features

- **User Authentication**: Email-based login and registration
- **Video Management**: Add YouTube videos by URL
- **Analytics Tracking**: Track views, likes, and comments over time
- **Dashboard Overview**: Visual charts and statistics
- **Multi-user Support**: View all users' videos
- **Automated Updates**: Scheduled analytics updates every hour
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Charts**: Chart.js
- **Authentication**: JWT tokens
- **API**: YouTube Data API v3

## Setup Instructions

### 1. Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud)
- YouTube Data API key

### 2. Installation

```bash
# Clone or download the project
cd youtube-dashboard

# Install dependencies
npm install
```

### 3. Environment Configuration

Create a `.env` file with the following variables:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/youtube-dashboard
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
YOUTUBE_API_KEY=your-youtube-api-key-here
NODE_ENV=development
```

### 4. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Add the API key to your `.env` file

### 5. Database Setup

Make sure MongoDB is running:

```bash
# For local MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env with your Atlas connection string
```

### 6. Run the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Visit `http://localhost:3000` to access the dashboard.

## Deployment to Render

### 1. Prepare for Deployment

1. Create a `render.yaml` file:

```yaml
services:
  - type: web
    name: youtube-dashboard
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        fromDatabase:
          name: youtube-dashboard-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: YOUTUBE_API_KEY
        sync: false

databases:
  - name: youtube-dashboard-db
    databaseName: youtube_dashboard
    user: admin
```

2. Update `package.json` engines:

```json
{
  "engines": {
    "node": ">=14.0.0"
  }
}
```

### 2. Deploy to Render

1. Push code to GitHub repository
2. Connect GitHub repo to Render
3. Set environment variables in Render dashboard:
   - `YOUTUBE_API_KEY`: Your YouTube API key
   - `JWT_SECRET`: A secure random string
   - `MONGODB_URI`: MongoDB connection string
   - `NODE_ENV`: production

### 3. Database Setup on Render

- Use Render's PostgreSQL add-on or
- Connect to MongoDB Atlas
- Update `MONGODB_URI` accordingly

## Usage

### 1. User Registration/Login

- Create account with email and password
- Login to access dashboard

### 2. Adding Videos

- Navigate to "Add Video" section
- Paste YouTube video URL
- Video will be automatically processed and added

### 3. Viewing Analytics

- **Overview**: Dashboard with total statistics and charts
- **My Videos**: Your added videos with detailed analytics
- **All Users Videos**: Browse videos from all users

### 4. Analytics Features

- **First Day Views**: Views recorded when video was first added
- **Current Views**: Latest view count
- **Growth Percentage**: Calculated growth from first day
- **Automated Updates**: Analytics update every hour via cron job

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Videos
- `POST /api/videos/add` - Add new video
- `GET /api/videos/my-videos` - Get user's videos
- `GET /api/videos/all` - Get all videos
- `DELETE /api/videos/:id` - Delete video

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/video/:id` - Video-specific analytics

## File Structure

```
youtube-dashboard/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── models/
│   ├── User.js            # User model
│   └── Video.js           # Video model
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── videos.js          # Video management routes
│   └── analytics.js       # Analytics routes
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── services/
│   └── youtubeService.js  # YouTube API integration
└── public/
    ├── index.html         # Main HTML file
    ├── css/
    │   └── style.css      # Styles
    └── js/
        └── app.js         # Frontend JavaScript
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting
- Input validation
- CORS protection

## Troubleshooting

### Common Issues

1. **YouTube API Quota Exceeded**
   - Check API usage in Google Cloud Console
   - Implement caching to reduce API calls

2. **MongoDB Connection Issues**
   - Verify MongoDB is running
   - Check connection string format
   - Ensure network access for cloud databases

3. **Video Not Found**
   - Verify video is public
   - Check YouTube URL format
   - Ensure API key has proper permissions

### Environment Variables

Make sure all required environment variables are set:
- `MONGODB_URI`
- `JWT_SECRET`
- `YOUTUBE_API_KEY`
- `PORT` (optional, defaults to 3000)

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - feel free to use for personal and commercial projects.