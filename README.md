# Smart Mail AI - Internship Email Processor

A specialized email processing system that automatically monitors Gmail for internship applications, analyzes resumes/CVs, and categorizes candidates as "Promising" or "Not Promising" using AI.

## 🚀 Features

- 🔍 **Gmail Monitoring**: Automatically polls Gmail every 10 minutes for new emails
- 🎯 **Keyword Detection**: Identifies internship-related emails using specific keywords
- 📄 **Resume Analysis**: Processes PDF and DOC/DOCX attachments
- 🤖 **AI Evaluation**: Uses OpenRouter (Claude-3-Sonnet) to evaluate candidates
- 🏷️ **Gmail Labeling**: Automatically creates and applies "Promising" or "Not Promising" labels
- 📧 **Inbox Management**: Moves processed emails out of inbox into organized labels
- 🔄 **Token Management**: Secure OAuth token storage in local JSON file
- ⚡ **Real-time Processing**: Immediate processing of new emails

## 📋 Evaluation Criteria

The AI evaluates candidates based on:
- **College/University**: Must be from NIRF Top 100 colleges
- **GPA**: Must be 8.0 or above (if mentioned)
- **Skills**: Must have relevant technical skills (ML, AI, Python, Computer Vision, etc.)

## 🔍 Keywords Detected

The system looks for these keywords (case-insensitive):
- "internship"
- "intern"
- "research intern/ internship"
- "summer internship"
- "winter internship"
- "research application"

## 🏗️ Architecture

### Frontend
- **React.js** with Material-UI components
- **Google OAuth** integration
- **Simplified UI** - only login and control panel
- **Real-time status** monitoring

### Backend
- **Node.js/Express.js** server
- **MySQL** database with Sequelize ORM
- **Gmail API** integration
- **OpenRouter API** for AI evaluation
- **Token-based authentication** with local JSON storage

## 🛠️ Setup

### Prerequisites
- Node.js (v16 or higher)
- MySQL database
- Google OAuth credentials
- OpenRouter API key

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DB_NAME=smart_mail
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000

# OpenRouter API
OPENAI_API_KEY=your_openrouter_api_key

# Server
PORT=4000
NODE_ENV=development
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smart-mail-ai
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up the database**
   ```bash
   cd ../backend
   npm run dev
   ```

5. **Start the frontend**
   ```bash
   cd ../frontend
   npm start
   ```

## 🚀 Usage

1. **Access the application** at `http://localhost:3000`
2. **Sign in with Google** using your Gmail account
3. **Start email monitoring** to begin processing
4. **Check Gmail labels** to see categorized emails
5. **Monitor the console** for processing logs

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth callback
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout and clear tokens
- `POST /api/auth/refresh` - Manually refresh tokens

### Internship Processing
- `POST /api/internship/start-polling` - Start Gmail monitoring
- `POST /api/internship/stop-polling` - Stop Gmail monitoring
- `GET /api/internship/polling-status` - Get monitoring status
- `GET /api/internship/processed-emails` - Get processed emails
- `GET /api/internship/statistics` - Get processing statistics
- `POST /api/internship/process-email/:messageId` - Manually process an email

### Health Check
- `GET /health` - Server health status

## ⚙️ Configuration

### Polling Interval
The polling interval can be configured in `backend/config/constants.js`:
```javascript
const POLL_INTERVAL = 600000; // 10 minutes in milliseconds
```

### Keywords
Add or modify keywords in `backend/config/constants.js`:
```javascript
const INTERNSHIP_KEYWORDS = [
  'internship',
  'intern',
  // Add more keywords here
];
```

## 🗄️ Database Schema

### ProcessedEmail
- `id` - Primary key
- `gmail_id` - Gmail message ID (unique)
- `subject` - Email subject
- `from` - Sender email
- `classification` - "Promising" or "Not Promising"
- `has_attachments` - Boolean flag
- `processed_at` - Processing timestamp
- `gmail_label_id` - Gmail label ID

## 🔒 Security

- **OAuth tokens** stored locally in `token.json` (not committed to git)
- **Environment variables** for sensitive configuration
- **CORS** configured for local development
- **Input validation** on all API endpoints

## 🐛 Troubleshooting

### Common Issues

1. **Authentication fails**
   - Check Google OAuth credentials
   - Verify redirect URI configuration
   - Check console for detailed error messages

2. **Gmail API errors**
   - Ensure Gmail API is enabled in Google Cloud Console
   - Check OAuth scopes include Gmail permissions
   - Verify token refresh is working

3. **Database connection issues**
   - Check MySQL service is running
   - Verify database credentials in `.env`
   - Ensure database exists

4. **AI evaluation fails**
   - Check OpenRouter API key is valid
   - Verify API quota and limits
   - Check network connectivity

### Logs

The system provides detailed logging:
- **Authentication** - OAuth flow and token management
- **Email processing** - Keyword detection and AI evaluation
- **Gmail operations** - API calls and label management
- **Error handling** - Detailed error messages and stack traces

## 🛠️ Development

### Adding New Features

1. **New keywords**: Update `INTERNSHIP_KEYWORDS` in constants
2. **Evaluation criteria**: Modify the AI prompt in `internshipProcessor.js`
3. **Email processing**: Extend the `processEmail` function in `gmailPoller.js`
4. **UI components**: Add new React components in the frontend

### Testing

- **Manual testing**: Use the manual email processing endpoint
- **API testing**: Use tools like Postman or curl
- **Integration testing**: Monitor logs during live processing

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub. 