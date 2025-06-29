const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class TokenManager {
  constructor() {
    this.tokenFilePath = path.join(__dirname, '..', 'token.json');
  }

  // Save tokens to token.json file
  async saveTokens(accessToken, refreshToken, expiry = null) {
    try {
      const tokenData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry: expiry || new Date(Date.now() + 3600000).toISOString(), // Default 1 hour
        created_at: new Date().toISOString()
      };

      await fs.writeFile(this.tokenFilePath, JSON.stringify(tokenData, null, 2));
      console.log('Tokens saved successfully to token.json');
      return true;
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  }

  // Read tokens from token.json file
  async getTokens() {
    try {
      const tokenData = await fs.readFile(this.tokenFilePath, 'utf8');
      const tokens = JSON.parse(tokenData);
      
      // Check if tokens are expired
      if (tokens.expiry && new Date(tokens.expiry) <= new Date()) {
        console.log('Tokens are expired, attempting refresh...');
        return await this.refreshTokens(tokens.refresh_token);
      }
      
      return tokens;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('token.json file not found');
        return null;
      }
      console.error('Error reading tokens:', error);
      throw error;
    }
  }

  // Refresh access token using refresh token
  async refreshTokens(refreshToken) {
    try {
      console.log('Refreshing access token...');
      
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const { access_token, expires_in } = response.data;
      const expiry = new Date(Date.now() + (expires_in * 1000)).toISOString();

      // Save the new tokens
      await this.saveTokens(access_token, refreshToken, expiry);
      
      console.log('Tokens refreshed successfully');
      return {
        access_token,
        refresh_token: refreshToken,
        expiry
      };
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw new Error('Failed to refresh tokens');
    }
  }

  // Check if tokens exist and are valid
  async hasValidTokens() {
    try {
      const tokens = await this.getTokens();
      return tokens && tokens.access_token;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  // Clear tokens (for logout)
  async clearTokens() {
    try {
      await fs.unlink(this.tokenFilePath);
      console.log('Tokens cleared successfully');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('token.json file already deleted');
        return true;
      }
      console.error('Error clearing tokens:', error);
      throw error;
    }
  }
}

module.exports = new TokenManager(); 