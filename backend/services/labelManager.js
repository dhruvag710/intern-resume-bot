const axios = require('axios');
const { GMAIL_LABELS } = require('../config/constants');

class LabelManager {
  constructor() {
    this.labelCache = new Map();
  }

  // Ensure required labels exist in Gmail
  async ensureLabelsExist(accessToken) {
    try {
      console.log('Ensuring Gmail labels exist...');

      // Get existing labels
      const existingLabels = await this.getExistingLabels(accessToken);
      
      // Check and create missing labels
      for (const [key, labelName] of Object.entries(GMAIL_LABELS)) {
        if (!existingLabels.find(label => label.name === labelName)) {
          await this.createLabel(labelName, accessToken);
          console.log(`Created label: ${labelName}`);
        } else {
          console.log(`Label already exists: ${labelName}`);
        }
      }

      // Update cache
      await this.updateLabelCache(accessToken);

    } catch (error) {
      console.error('Error ensuring labels exist:', error);
      throw error;
    }
  }

  // Get existing Gmail labels
  async getExistingLabels(accessToken) {
    try {
      const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return response.data.labels || [];
    } catch (error) {
      console.error('Error fetching existing labels:', error);
      throw error;
    }
  }

  // Create a new Gmail label
  async createLabel(labelName, accessToken) {
    try {
      const response = await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return response.data;
    } catch (error) {
      console.error(`Error creating label ${labelName}:`, error);
      throw error;
    }
  }

  // Update label cache
  async updateLabelCache(accessToken) {
    try {
      const labels = await this.getExistingLabels(accessToken);
      
      this.labelCache.clear();
      labels.forEach(label => {
        this.labelCache.set(label.name, label.id);
      });

      console.log('Label cache updated');
    } catch (error) {
      console.error('Error updating label cache:', error);
    }
  }

  // Apply label to email
  async applyLabel(messageId, labelName, accessToken) {
    try {
      console.log(`Applying label '${labelName}' to email ${messageId}`);

      // Get label ID from cache or fetch it
      let labelId = this.labelCache.get(labelName);
      
      if (!labelId) {
        await this.updateLabelCache(accessToken);
        labelId = this.labelCache.get(labelName);
      }

      if (!labelId) {
        throw new Error(`Label '${labelName}' not found`);
      }

      // Apply label to email
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          addLabelIds: [labelId]
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      console.log(`Successfully applied label '${labelName}' to email ${messageId}`);
      return response.data;

    } catch (error) {
      console.error(`Error applying label '${labelName}' to email ${messageId}:`, error);
      throw error;
    }
  }

  // Remove label from email
  async removeLabel(messageId, labelName, accessToken) {
    try {
      console.log(`Removing label '${labelName}' from email ${messageId}`);

      let labelId = this.labelCache.get(labelName);
      
      if (!labelId) {
        await this.updateLabelCache(accessToken);
        labelId = this.labelCache.get(labelName);
      }

      if (!labelId) {
        throw new Error(`Label '${labelName}' not found`);
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          removeLabelIds: [labelId]
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      console.log(`Successfully removed label '${labelName}' from email ${messageId}`);
      return response.data;

    } catch (error) {
      console.error(`Error removing label '${labelName}' from email ${messageId}:`, error);
      throw error;
    }
  }

  // Get all labels with their IDs
  async getAllLabels(accessToken) {
    try {
      const labels = await this.getExistingLabels(accessToken);
      return labels.map(label => ({
        id: label.id,
        name: label.name,
        type: label.type
      }));
    } catch (error) {
      console.error('Error getting all labels:', error);
      throw error;
    }
  }

  // Check if label exists
  async labelExists(labelName, accessToken) {
    try {
      const labels = await this.getExistingLabels(accessToken);
      return labels.some(label => label.name === labelName);
    } catch (error) {
      console.error(`Error checking if label '${labelName}' exists:`, error);
      return false;
    }
  }

  // Helper to get a label ID from cache, fetching if necessary
  async getLabelId(labelName, accessToken) {
    let labelId = this.labelCache.get(labelName);
    if (!labelId) {
      await this.updateLabelCache(accessToken);
      labelId = this.labelCache.get(labelName);
    }
    if (!labelId) {
      // Try to auto-create the label if still not found
      try {
        await this.createLabel(labelName, accessToken);
        await this.updateLabelCache(accessToken);
        labelId = this.labelCache.get(labelName);
        if (labelId) {
          console.log(`Auto-created missing label: ${labelName}`);
        } else {
          console.error(`Failed to auto-create label: ${labelName}`);
        }
      } catch (err) {
        console.error(`Error auto-creating label '${labelName}':`, err);
      }
    }
    return labelId;
  }

  // Marks an email as processed by applying classification and processed labels, and marking as read
  async markEmailAsProcessed(messageId, classificationLabel, accessToken) {
    try {
      console.log(`Marking email ${messageId} as processed with label '${classificationLabel}'`);

      // Only use labels of type 'user'
      const getUserLabelId = async (labelName) => {
        await this.updateLabelCache(accessToken);
        const labels = await this.getExistingLabels(accessToken);
        const userLabel = labels.find(l => l.name === labelName && l.type === 'user');
        return userLabel ? userLabel.id : null;
      };

      // Get system label IDs
      const getSystemLabelId = async (labelName) => {
        await this.updateLabelCache(accessToken);
        const labels = await this.getExistingLabels(accessToken);
        const systemLabel = labels.find(l => l.name === labelName && l.type === 'system');
        return systemLabel ? systemLabel.id : null;
      };

      let classificationLabelId = await getUserLabelId(classificationLabel);
      let processedLabelId = await getUserLabelId(GMAIL_LABELS.PROCESSED);
      let inboxLabelId = await getSystemLabelId('INBOX');

      // Log label IDs and names
      console.log(`Classification label: ${classificationLabel} (ID: ${classificationLabelId})`);
      console.log(`Processed label: ${GMAIL_LABELS.PROCESSED} (ID: ${processedLabelId})`);
      console.log(`INBOX label: INBOX (ID: ${inboxLabelId})`);

      if (!classificationLabelId || !processedLabelId) {
        throw new Error(`Could not find or create required user labels for email ${messageId}`);
      }

      const applyLabels = async () => {
        const modifyData = {
          addLabelIds: [classificationLabelId, processedLabelId]
        };

        // Remove from inbox if inbox label ID is found
        if (inboxLabelId) {
          modifyData.removeLabelIds = [inboxLabelId];
          console.log(`Removing email ${messageId} from inbox`);
        }

        await axios.post(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
          modifyData,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      };

      try {
        await applyLabels();
        console.log(`Successfully marked email ${messageId} as processed and moved out of inbox.`);
      } catch (err) {
        // If 400 error, retry after short delay and re-fetch label cache
        if (err.response && err.response.status === 400) {
          console.warn('400 error applying labels, retrying after short delay...');
          await new Promise(res => setTimeout(res, 1500));
          // Re-fetch label IDs
          classificationLabelId = await getUserLabelId(classificationLabel);
          processedLabelId = await getUserLabelId(GMAIL_LABELS.PROCESSED);
          inboxLabelId = await getSystemLabelId('INBOX');
          console.log(`Retrying with label IDs: ${classificationLabelId}, ${processedLabelId}, INBOX: ${inboxLabelId}`);
          if (classificationLabelId && processedLabelId) {
            try {
              await applyLabels();
              console.log(`Successfully marked email ${messageId} as processed on retry.`);
            } catch (retryErr) {
              console.error(`Retry failed to mark email ${messageId} as processed:`, retryErr);
            }
          } else {
            console.error(`Labels still not found after retry for email ${messageId}`);
          }
        } else {
          console.error(`Error marking email ${messageId} as processed:`, err);
        }
      }
    } catch (error) {
      console.error(`Error marking email ${messageId} as processed:`, error);
      // We don't re-throw here to prevent the entire polling cycle from stopping
    }
  }
}

module.exports = LabelManager; 