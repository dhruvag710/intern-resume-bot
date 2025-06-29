const axios = require('axios');
const { POLL_INTERVAL, GMAIL_API_CONFIG, INTERNSHIP_KEYWORDS, GMAIL_LABELS } = require('../config/constants');
const tokenManager = require('./tokenManager');
const ProcessedEmail = require('../models/ProcessedEmail');
const internshipProcessor = require('./internshipProcessor');
const LabelManager = require('./labelManager');
const labelManager = new LabelManager();

class GmailPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = null;
  }

  // Start polling for new emails
  async startPolling() {
    if (this.isPolling) {
      console.log('Gmail polling is already running');
      return;
    }

    console.log(`Starting Gmail polling with interval: ${POLL_INTERVAL}ms`);
    this.isPolling = true;

    // Initial poll
    await this.pollForNewEmails();

    // Set up interval for continuous polling
    this.pollInterval = setInterval(async () => {
      await this.pollForNewEmails();
    }, POLL_INTERVAL);
  }

  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('Gmail polling stopped');
  }

  // Main polling function
  async pollForNewEmails() {
    try {
      console.log('\n=== Polling for new emails ===');
      
      // Check if we have valid tokens
      const hasTokens = await tokenManager.hasValidTokens();
      if (!hasTokens) {
        console.log('No valid tokens found, skipping poll');
        return;
      }

      const tokens = await tokenManager.getTokens();
      
      // Fetch last 20 emails from Gmail (regardless of processing status)
      const emails = await this.fetchUnreadEmails(tokens.access_token);
      
      if (!emails || emails.length === 0) {
        console.log('No emails found');
        return;
      }

      console.log(`Found ${emails.length} emails (last 20 regardless of processing status)`);

      let processedCount = 0;
      let skippedCount = 0;
      let keywordCount = 0;

      // Process each email
      for (const email of emails) {
        const result = await this.processEmail(email, tokens.access_token);
        if (result === 'processed') {
          processedCount++;
        } else if (result === 'skipped') {
          skippedCount++;
        } else if (result === 'no_keywords') {
          keywordCount++;
        }
      }

      console.log(`\nProcessing Summary:`);
      console.log(`  - Already processed: ${skippedCount}`);
      console.log(`  - No internship keywords: ${keywordCount}`);
      console.log(`  - Newly processed: ${processedCount}`);

    } catch (error) {
      console.error('Error during email polling:', error);
      
      // If token error, try to refresh
      if (error.response?.status === 401) {
        console.log('Token expired, attempting refresh...');
        try {
          const tokens = await tokenManager.getTokens();
          if (tokens) {
            console.log('Token refreshed successfully');
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
        }
      }
    } finally {
      console.log('POLLING COMPLETED\n');
    }
  }

  // Fetch last 20 emails from Gmail API
  async fetchUnreadEmails(accessToken) {
    try {
      const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          maxResults: GMAIL_API_CONFIG.maxResults,
          q: GMAIL_API_CONFIG.query
        }
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  // Process individual email
  async processEmail(email, accessToken) {
    try {
      // Fetch full email details first for better logging
      const emailDetails = await this.fetchEmailDetails(email.id, accessToken);
      
      const subject = this.getEmailHeader(emailDetails, 'Subject');
      const from = this.getEmailHeader(emailDetails, 'From');

      console.log(`\nProcessing email: ${email.id}`);
      console.log(`  From: ${from}`);
      console.log(`  Subject: ${subject}`);
      
      // Check if email was already processed
      const existing = await ProcessedEmail.findOne({
        where: { gmail_id: email.id }
      });

      if (existing) {
        console.log(`-> Email ${email.id} already processed, skipping`);
        return 'skipped';
      }

      // Check if email contains internship keywords
      const containsKeywords = this.checkForInternshipKeywords(emailDetails);
      
      if (!containsKeywords) {
        console.log(`-> Email ${email.id} does not contain internship keywords, skipping`);
        return 'no_keywords';
      }

      console.log(`-> Email ${email.id} contains internship keywords, processing...`);

      // Process the internship email
      const result = await internshipProcessor.processInternshipEmail(emailDetails, accessToken);
      
      if (result) {
        const labelName = result.classification === 'Promising' 
          ? GMAIL_LABELS.PROMISING 
          : GMAIL_LABELS.NOT_PROMISING;
        
        await labelManager.markEmailAsProcessed(email.id, labelName, accessToken);

        // Save to database
        await ProcessedEmail.create({
          gmail_id: email.id,
          subject: this.getEmailHeader(emailDetails, 'Subject'),
          from: this.getEmailHeader(emailDetails, 'From'),
          classification: result.classification,
          has_attachments: result.hasAttachments,
          gmail_label_id: result.labelId
        });

        console.log(`-> Email ${email.id} processed and labeled as: ${result.classification}`);
        return 'processed';
      }

      return 'no_keywords';

    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
      return 'error';
    }
  }

  // Fetch detailed email information
  async fetchEmailDetails(messageId, accessToken) {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching email details for ${messageId}:`, error);
      throw error;
    }
  }

  // Check if email contains internship keywords
  checkForInternshipKeywords(emailDetails) {
    const subject = this.getEmailHeader(emailDetails, 'Subject') || '';
    const snippet = emailDetails.snippet || '';
    
    const fullText = `${subject} ${snippet}`.toLowerCase();
    
    return INTERNSHIP_KEYWORDS.some(keyword => 
      fullText.includes(keyword.toLowerCase())
    );
  }

  // Helper to get email header
  getEmailHeader(emailDetails, headerName) {
    const header = emailDetails.payload?.headers?.find(
      h => h.name.toLowerCase() === headerName.toLowerCase()
    );
    return header?.value || '';
  }

  // Get polling status
  getStatus() {
    return {
      isPolling: this.isPolling,
      pollInterval: POLL_INTERVAL
    };
  }
}

module.exports = new GmailPoller(); 