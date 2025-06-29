import './App.css';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useState, useEffect } from 'react';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Check authentication and polling status on mount
  useEffect(() => {
    const checkInitialStatus = async () => {
      await checkAuthStatus();
      await getPollingStatus();
    };
    checkInitialStatus();
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/auth/status');
      if (response.data.authenticated) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const getPollingStatus = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/internship/polling-status');
      setIsPolling(response.data.isPolling);
    } catch (error) {
      console.error('Error getting polling status:', error);
      setIsPolling(false);
    }
  };

  const login = useGoogleLogin({
    flow: 'auth-code',
    scope:
      'openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.labels',
    access_type: 'offline',
    prompt: 'consent',
    onSuccess: async (response) => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('Sending authorization code to backend...');
        
        const res = await axios.post('http://localhost:4000/api/auth/google', {
          code: response.code,
        });

        console.log('Authentication successful:', res.data);
        
        if (res.data.success) {
          setIsAuthenticated(true);
          setError(null);
        } else {
          setError('Authentication failed. Please try again.');
        }
      } catch (err) {
        console.error('Backend error:', err);
        setError('Failed to authenticate. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('Login failed:', error);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    },
  });

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:4000/api/auth/logout');
      setIsAuthenticated(false);
      setIsPolling(false);
      setError(null);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout. Please try again.');
    }
  };

  const startPolling = async () => {
    try {
      const response = await axios.post('http://localhost:4000/api/internship/start-polling');
      console.log('Polling started:', response.data);
      alert('Gmail polling started successfully! The system will now monitor your emails for internship applications.');
      setIsPolling(true);
    } catch (error) {
      console.error('Error starting polling:', error);
      alert('Failed to start polling. Please check the console for details.');
    }
  };

  const stopPolling = async () => {
    try {
      const response = await axios.post('http://localhost:4000/api/internship/stop-polling');
      console.log('Polling stopped:', response.data);
      alert('Gmail polling stopped successfully!');
      setIsPolling(false);
    } catch (error) {
      console.error('Error stopping polling:', error);
      alert('Failed to stop polling. Please check the console for details.');
    }
  };

  if (isAuthenticated) {
    return (
      <div className="app-container">
        <div className="success-card">
          <div className="success-icon">
            <span className="material-icons">check_circle</span>
          </div>
          <h1>Authentication Successful!</h1>
          <p>Your Gmail account has been connected successfully.</p>
          
          <div className="action-buttons">
            {!isPolling ? (
              <button 
                className="action-button start-button" 
                onClick={startPolling}
              >
                <span className="material-icons">play_arrow</span>
                Start Email Monitoring
              </button>
            ) : (
              <button 
                className="action-button stop-button" 
                onClick={stopPolling}
              >
                <span className="material-icons">stop</span>
                Stop Email Monitoring
              </button>
            )}
          </div>

          <div className="info-section">
            <h3>What happens next?</h3>
            <ul>
              <li>The system will monitor your Gmail for new unread emails</li>
              <li>Emails containing internship keywords will be automatically processed</li>
              <li>Resumes/CVs will be analyzed using AI</li>
              <li>Emails will be labeled as "Promising" or "Not Promising"</li>
              <li>Check your Gmail labels to see the results</li>
            </ul>
          </div>

          <button 
            className="logout-button" 
            onClick={handleLogout}
          >
            <span className="material-icons">logout</span>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <span className="material-icons logo-icon">smart_toy</span>
          <h1>Smart Mail AI</h1>
        </div>
        
        <div className="welcome-section">
          <h2>Internship Email Processor</h2>
          <p>Automatically analyze and categorize internship applications</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="material-icons">error_outline</span>
            <p>{error}</p>
          </div>
        )}

        <button 
          className={`google-sign-in-button ${isLoading ? 'loading' : ''}`} 
          onClick={() => login()}
          disabled={isLoading}
        >
          {!isLoading && (
            <>
              <img 
                src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" 
                alt="Google logo" 
                className="google-icon" 
              />
              <span>Sign in with Google</span>
            </>
          )}
          {isLoading && (
            <>
              <div className="button-spinner"></div>
              <span>Signing in...</span>
            </>
          )}
        </button>

        <div className="features-section">
          <h3>Features:</h3>
          <ul>
            <li>🔍 Monitors Gmail for internship-related emails</li>
            <li>📄 Analyzes resume/CV attachments</li>
            <li>🤖 AI-powered candidate evaluation</li>
            <li>🏷️ Automatic Gmail labeling</li>
            <li>⚡ Real-time processing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
