const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { RESUME_FILE_TYPES } = require('../config/constants');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

const INTERNSHIP_EVALUATION_PROMPT = `You are an expert internship evaluation assistant. Your job is to analyze internship request emails and attached resumes and classify whether the candidate is PROMISING or NOT PROMISING.

You MUST be extremely critical and follow the rules precisely. Do not invent or hallucinate any information. If a piece of information (like GPA or college name) is not explicitly present, state that it is not found.

### MANDATORY REJECTION RULES:
1. **GPA/CGPA must be explicitly stated.**
   - Search the email and resume text for a GPA or CGPA.
   - If no GPA/CGPA is explicitly found, you MUST classify the candidate as "Not Promising". This is the most important rule. Do not make assumptions.

2. **GPA must be 8.0 or higher (on a 10-point scale).**
   - If the GPA is found but is below 8.0, classify as "Not Promising".

3. **The candidate must be from a NIRF Top 100 Indian College/University.**
   - If the college name is not found or is not in the NIRF Top 100 list, classify as "Not Promising".
   - Examples of acceptable colleges: IITs, NITs, BITS Pilani, IIIT-Hyderabad, Delhi University, Mumbai University.
   - Examples of unacceptable colleges: Amity University, CSVTU, DIAT.

### EVALUATION LOGIC:
1. First, check for GPA. If missing, immediately decide "Not Promising".
2. If GPA is present, check if it's >= 8.0. If not, "Not Promising".
3. If GPA is OK, check the college. If not NIRF Top 100, "Not Promising".
4. Only if all three mandatory rules pass, then evaluate skills, projects, and motivation to decide "Promising".

### RESPONSE FORMAT (STRICT JSON ONLY):
{
  "classification": "Promising" or "Not Promising",
  "reasoning": "Concise 2-3 line explanation. YOU MUST explicitly mention the GPA found (or state 'Not Found') and the college name.",
  "college": "College name if found, otherwise 'Not Found'",
  "gpa": "The exact GPA value found. If not found, you MUST return 'Not Found'. Do NOT invent a GPA.",
  "skills": ["Skill1", "Skill2", ...]   // Extract only if Promising, else keep empty list
}`;

class InternshipProcessor {
  constructor() {
    this.openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  // Main processing function
  async processInternshipEmail(emailDetails, accessToken) {
    try {
      console.log('Processing internship email...');

      // Extract email content
      const emailContent = this.extractEmailContent(emailDetails);
      
      // Check for and process attachments
      const attachments = await this.processAttachments(emailDetails, accessToken);
      
      // Prepare content for evaluation
      const evaluationContent = this.prepareEvaluationContent(emailContent, attachments);
      
      // Get AI evaluation
      const evaluation = await this.evaluateWithAI(evaluationContent);
      
      return {
        classification: evaluation.classification,
        reasoning: evaluation.reasoning,
        hasAttachments: attachments.length > 0,
        labelId: null // Will be set by label manager
      };

    } catch (error) {
      console.error('Error processing internship email:', error);
      throw error;
    }
  }

  // Extract email content from Gmail message
  extractEmailContent(emailDetails) {
    let content = '';
    
    // Get subject
    const subject = this.getEmailHeader(emailDetails, 'Subject') || '';
    content += `Subject: ${subject}\n\n`;
    
    // Get from
    const from = this.getEmailHeader(emailDetails, 'From') || '';
    content += `From: ${from}\n\n`;
    
    // Get body content
    const body = this.extractBodyContent(emailDetails);
    content += `Content: ${body}\n\n`;
    
    return content;
  }

  // Extract body content from email parts
  extractBodyContent(emailDetails) {
    const payload = emailDetails.payload;
    
    if (!payload) {
      return emailDetails.snippet || '';
    }

    // Handle multipart messages
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain') {
          return this.decodeContent(part.body.data);
        }
      }
    }

    // Handle single part messages
    if (payload.body && payload.body.data) {
      return this.decodeContent(payload.body.data);
    }

    return emailDetails.snippet || '';
  }

  // Decode base64 content
  decodeContent(data) {
    try {
      return Buffer.from(data, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Error decoding content:', error);
      return '';
    }
  }

  // Process email attachments
  async processAttachments(emailDetails, accessToken) {
    const attachments = [];
    const payload = emailDetails.payload;

    if (!payload) return attachments;

    // Recursively find all attachments
    const findAttachments = (part) => {
      if (part.parts) {
        part.parts.forEach(findAttachments);
      } else if (part.filename && RESUME_FILE_TYPES.includes(part.mimeType)) {
        attachments.push(part);
      }
    };

    findAttachments(payload);

    // Download and extract text from attachments
    for (const attachment of attachments) {
      try {
        console.log(`Processing attachment: ${attachment.filename}`);
        const attachmentData = await this.downloadAttachment(
          emailDetails.id,
          attachment.body.attachmentId,
          accessToken
        );
        attachment.base64Data = attachmentData;

        // Extract text based on file type
        let extractedText = '';
        if (attachment.mimeType === 'application/pdf') {
          // Write to temp file, parse, then delete
          const tempPath = path.join(__dirname, '../../tmp', `${Date.now()}_${attachment.filename}`);
          await fs.mkdir(path.dirname(tempPath), { recursive: true });
          await fs.writeFile(tempPath, Buffer.from(attachmentData, 'base64'));
          try {
            const data = await pdfParse(await fs.readFile(tempPath));
            extractedText = data.text;
          } catch (err) {
            console.error('Error extracting PDF text:', err);
          }
          await fs.unlink(tempPath);
        } else if (attachment.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // Write to temp file, parse, then delete
          const tempPath = path.join(__dirname, '../../tmp', `${Date.now()}_${attachment.filename}`);
          await fs.mkdir(path.dirname(tempPath), { recursive: true });
          await fs.writeFile(tempPath, Buffer.from(attachmentData, 'base64'));
          try {
            const result = await mammoth.extractRawText({ path: tempPath });
            extractedText = result.value;
          } catch (err) {
            console.error('Error extracting DOCX text:', err);
          }
          await fs.unlink(tempPath);
        } else if (attachment.mimeType === 'application/msword') {
          // DOC files not supported by mammoth, fallback to base64 or skip
          extractedText = '[DOC file detected, text extraction not supported]';
        }
        attachment.extractedText = extractedText;
        console.log(`Successfully processed attachment: ${attachment.filename}`);
      } catch (error) {
        console.error(`Error processing attachment ${attachment.filename}:`, error);
        attachment.extractedText = '';
      }
    }

    return attachments;
  }

  // Download attachment from Gmail API
  async downloadAttachment(messageId, attachmentId, accessToken) {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw error;
    }
  }

  // Prepare content for AI evaluation
  prepareEvaluationContent(emailContent, attachments) {
    let content = emailContent;
    if (attachments.length > 0) {
      content += '\n\n=== RESUME/CV ATTACHMENTS ===\n';
      attachments.forEach((attachment, index) => {
        content += `\nAttachment ${index + 1}: ${attachment.filename}\n`;
        content += `Type: ${attachment.mimeType}\n`;
        if (attachment.extractedText && attachment.extractedText.trim()) {
          content += `Content: ${attachment.extractedText.substring(0, 5000)}\n`;
        } else {
          content += 'Content: [No text extracted]\n';
        }
      });
    }
    return content;
  }

  // Evaluate with OpenRouter AI
  async evaluateWithAI(content) {
    try {
      console.log('Sending evaluation request to OpenRouter...');

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch(this.openRouterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'OpenRouter-Referrer': 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-sonnet",
          messages: [
            {
              role: "system",
              content: INTERNSHIP_EVALUATION_PROMPT
            },
            {
              role: "user",
              content: content
            }
          ],
          temperature: 0.2,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenRouter');
      }

      const aiResponse = data.choices[0].message.content;
      
      // Parse JSON response, with fallback for non-JSON responses
      try {
        // The AI sometimes wraps the JSON in markdown, so we extract it.
        const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
        const jsonResponse = jsonMatch ? jsonMatch[1] : aiResponse;

        const evaluation = JSON.parse(jsonResponse);
        
        // Validate response format
        if (!evaluation.classification || !['Promising', 'Not Promising'].includes(evaluation.classification)) {
          // If validation fails, treat it as a parse error
          throw new Error('Invalid classification in AI response');
        }

        console.log('AI Evaluation:', evaluation);
        return evaluation;
      } catch (parseError) {
        console.warn('Could not parse AI response as JSON. Treating as "Not Promising".');
        console.warn('Raw AI response:', aiResponse);
        // Fallback for non-JSON responses
        return {
          classification: 'Not Promising',
          reasoning: `AI response was not in the expected format. Raw response: ${aiResponse}`,
          college: null,
          gpa: null,
          skills: []
        };
      }
    } catch (error) {
      console.error('Error in AI evaluation:', error);
      throw error;
    }
  }

  // Helper to get email header
  getEmailHeader(emailDetails, headerName) {
    const header = emailDetails.payload?.headers?.find(
      h => h.name.toLowerCase() === headerName.toLowerCase()
    );
    return header?.value || '';
  }
}

module.exports = new InternshipProcessor(); 