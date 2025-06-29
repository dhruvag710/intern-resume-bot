const express = require('express');
const router = express.Router();
const tokenManager = require('../services/tokenManager');
const gmailPoller = require('../services/gmailPoller');
const ProcessedEmail = require('../models/ProcessedEmail');

// Start Gmail polling
router.post('/start-polling', async (req, res) => {
  try {
    console.log('Starting Gmail polling...');
    
    // Check if we have valid tokens
    const hasTokens = await tokenManager.hasValidTokens();
    if (!hasTokens) {
      return res.status(401).json({ 
        error: 'No valid tokens found. Please authenticate first.' 
      });
    }

    // Start polling
    await gmailPoller.startPolling();
    
    res.json({
      success: true,
      message: 'Gmail polling started successfully',
      status: gmailPoller.getStatus()
    });
  } catch (error) {
    console.error('Error starting polling:', error);
    res.status(500).json({ 
      error: 'Failed to start polling',
      details: error.message 
    });
  }
});

// Stop Gmail polling
router.post('/stop-polling', async (req, res) => {
  try {
    console.log('Stopping Gmail polling...');
    
    gmailPoller.stopPolling();
    
    res.json({
      success: true,
      message: 'Gmail polling stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping polling:', error);
    res.status(500).json({ 
      error: 'Failed to stop polling',
      details: error.message 
    });
  }
});

// Get polling status
router.get('/polling-status', async (req, res) => {
  try {
    const status = gmailPoller.getStatus();
    const hasTokens = await tokenManager.hasValidTokens();
    
    res.json({
      isPolling: status.isPolling,
      pollInterval: status.pollInterval,
      hasValidTokens: hasTokens
    });
  } catch (error) {
    console.error('Error getting polling status:', error);
    res.status(500).json({ 
      error: 'Failed to get polling status',
      details: error.message 
    });
  }
});

// Get processed emails
router.get('/processed-emails', async (req, res) => {
  try {
    const { page = 1, limit = 20, classification } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (classification && ['Promising', 'Not Promising'].includes(classification)) {
      whereClause.classification = classification;
    }
    
    const emails = await ProcessedEmail.findAndCountAll({
      where: whereClause,
      order: [['processed_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      emails: emails.rows,
      total: emails.count,
      page: parseInt(page),
      totalPages: Math.ceil(emails.count / limit)
    });
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    res.status(500).json({ 
      error: 'Failed to fetch processed emails',
      details: error.message 
    });
  }
});

// Get statistics
router.get('/statistics', async (req, res) => {
  try {
    const totalProcessed = await ProcessedEmail.count();
    const promisingCount = await ProcessedEmail.count({
      where: { classification: 'Promising' }
    });
    const notPromisingCount = await ProcessedEmail.count({
      where: { classification: 'Not Promising' }
    });
    const withAttachments = await ProcessedEmail.count({
      where: { has_attachments: true }
    });
    
    res.json({
      totalProcessed,
      promisingCount,
      notPromisingCount,
      withAttachments,
      promisingPercentage: totalProcessed > 0 ? (promisingCount / totalProcessed * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  }
});

// Manual processing of a specific email (for testing)
router.post('/process-email/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Check if we have valid tokens
    const hasTokens = await tokenManager.hasValidTokens();
    if (!hasTokens) {
      return res.status(401).json({ 
        error: 'No valid tokens found. Please authenticate first.' 
      });
    }

    const tokens = await tokenManager.getTokens();
    
    // Check if already processed
    const existing = await ProcessedEmail.findOne({
      where: { gmail_id: messageId }
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'Email already processed',
        classification: existing.classification 
      });
    }

    // Process the email
    await gmailPoller.processEmail({ id: messageId }, tokens.access_token);
    
    res.json({
      success: true,
      message: 'Email processed successfully'
    });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ 
      error: 'Failed to process email',
      details: error.message 
    });
  }
});

module.exports = router; 