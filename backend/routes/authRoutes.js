const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const tokenManager = require('../services/tokenManager');

// Google OAuth configuration
const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000'
);

// Handle Google OAuth callback
router.post('/google', async (req, res) => {
  try {
    console.log('Received Google OAuth callback');
    
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for tokens
    const { tokens } = await oAuth2Client.getToken({ code });
    
    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(400).json({ error: 'Failed to obtain access and refresh tokens' });
    }

    console.log('Successfully obtained tokens from Google');

    // Save tokens to token.json file
    await tokenManager.saveTokens(
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    );

    console.log('Tokens saved to token.json successfully');

    res.json({
      success: true,
      message: 'Authentication successful',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  try {
    const hasValidTokens = await tokenManager.hasValidTokens();
    
    res.json({
      authenticated: hasValidTokens,
      message: hasValidTokens ? 'User is authenticated' : 'User is not authenticated'
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ 
      error: 'Failed to check authentication status',
      details: error.message 
    });
  }
});

// Logout - clear tokens
router.post('/logout', async (req, res) => {
  try {
    await tokenManager.clearTokens();
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ 
      error: 'Failed to logout',
      details: error.message 
    });
  }
});

// Refresh tokens manually (for testing)
router.post('/refresh', async (req, res) => {
  try {
    const tokens = await tokenManager.getTokens();
    
    if (!tokens || !tokens.refresh_token) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    const newTokens = await tokenManager.refreshTokens(tokens.refresh_token);
    
    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      access_token: newTokens.access_token,
      expires_in: newTokens.expires_in
    });
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    res.status(500).json({ 
      error: 'Failed to refresh tokens',
      details: error.message 
    });
  }
});

module.exports = router; 