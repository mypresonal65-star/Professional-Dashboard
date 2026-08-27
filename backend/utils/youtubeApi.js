// YouTube API Helper
const { google } = require('googleapis');

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/auth/youtube/callback';

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/**
 * Get YouTube auth URL for user login
 */
function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent'
  });
}

/**
 * Exchange code for tokens
 */
async function getTokens(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get playlist items (including private videos)
 */
async function getPlaylistItems(playlistId, accessToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  
  const response = await youtube.playlistItems.list({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: 50
  });
  
  return response.data.items || [];
}

/**
 * Get video details
 */
async function getVideoDetails(videoId, accessToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  
  const response = await youtube.videos.list({
    part: 'snippet,contentDetails,status',
    id: videoId
  });
  
  return response.data.items?.[0] || null;
}

module.exports = { createOAuth2Client, getAuthUrl, getTokens, getPlaylistItems, getVideoDetails };
