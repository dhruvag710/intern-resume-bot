const POLL_INTERVAL = 600000; // Poll every 10 minutes

const GMAIL_API_CONFIG = {
  maxResults: 20, // Max emails to fetch per poll
  query: '', // Fetch last 20 emails regardless of processing status
};

const INTERNSHIP_KEYWORDS = [
  'internship',
  'intern',
  'research intern/ internship',
  'summer internship',
  'winter internship',
  'research application',
];

const RESUME_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const GMAIL_LABELS = {
  PARENT: 'Internship',
  PROMISING: 'Internship/Promising',
  NOT_PROMISING: 'Internship/Not Promising',
  PROCESSED: 'Internship/Processed'
};

module.exports = {
  POLL_INTERVAL,
  GMAIL_API_CONFIG,
  INTERNSHIP_KEYWORDS,
  RESUME_FILE_TYPES,
  GMAIL_LABELS,
}; 