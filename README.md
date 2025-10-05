# DateFlow AI - Intelligent Dating Assistant

DateFlow AI is a sophisticated dating assistant application that helps users plan amazing dates, find restaurants, and create memorable experiences. Built with modern web technologies and powered by AI, it provides personalized recommendations and seamless voice interaction.

## 🚀 Features

### Core Functionality
- **AI-Powered Date Planning**: Get intelligent suggestions for romantic activities and experiences
- **Real Event Integration**: Access live events from Ticketmaster and Eventbrite APIs
- **Smart Event Caching**: Pre-fetch and cache events for faster loading
- **Voice Interaction**: Natural voice commands with text-to-speech responses
- **Partner Profile Management**: Store and use partner preferences for personalized suggestions
- **Conversation History**: Keep track of your planning sessions
- **Real-time Chat**: Interactive chat interface with AI assistant
- **DateFlow Generation**: Create detailed, step-by-step date itineraries
- **Email Invitations**: Send beautiful DateFlow invitations with calendar attachments

### Technical Features
- **Modern React Frontend**: Beautiful, responsive user interface with React Context
- **Node.js Backend**: Robust API with Express.js and comprehensive error handling
- **AI Integration**: Powered by Groq API with optimized prompts and rate limiting
- **Voice Processing**: Deepgram integration for speech-to-text and text-to-speech
- **Authentication**: Secure user authentication and session management
- **Database**: MongoDB with Mongoose for data persistence
- **Event APIs**: Ticketmaster and Eventbrite integration for real-time events
- **Email Service**: SendGrid integration for DateFlow invitations
- **Smart Caching**: In-memory caching system for events and user data

## 🛠️ Tech Stack

### Frontend
- **React.js** - Modern UI framework
- **CSS3** - Advanced styling with glassmorphism effects
- **JavaScript ES6+** - Modern JavaScript features

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens

### AI & Voice
- **Groq API** - AI language model with optimized prompts
- **Deepgram** - Speech-to-text and text-to-speech
- **Web Audio API** - Voice processing

### External APIs
- **Ticketmaster API** - Live event data
- **Eventbrite API** - Additional event sources
- **SendGrid API** - Email service for DateFlow invitations

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Git

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/dateflow-ai.git
   cd dateflow-ai
   ```

2. **Install backend dependencies**
   ```bash
   cd dating-agent-backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../dating-agent-frontend
   npm install
   ```

4. **Environment Configuration**
   
   Run the setup script to create your `.env` file:
   ```bash
   cd dating-agent-backend
   chmod +x setup-env.sh
   ./setup-env.sh
   ```
   
   Or manually create a `.env` file with:
   ```env
   # Server Configuration
   PORT=5001
   NODE_ENV=development
   
   # Database
   MONGODB_URI=your-mongodb-connection-string
   
   # JWT Secret
   JWT_SECRET=your-super-secret-jwt-key
   
   # AI & Voice APIs
   GROQ_API_KEY=your-groq-api-key
   DEEPGRAM_API_KEY=your-deepgram-api-key
   
   # Event APIs
   TICKETMASTER_CONSUMER_KEY=your-ticketmaster-key
   TICKETMASTER_CONSUMER_SECRET=your-ticketmaster-secret
   EVENTBRITE_API_KEY=your-eventbrite-api-key
   
   # Email Service
   SENDGRID_API_KEY=your-sendgrid-api-key
   SENDGRID_FROM_EMAIL=your-email@example.com
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

5. **Start MongoDB**
   ```bash
   mongod
   ```

6. **Start the backend server**
   ```bash
   cd dating-agent-backend
   npm run dev
   ```

7. **Start the frontend development server**
   ```bash
   cd dating-agent-frontend
   npm start
   ```

8. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

## 🎯 Usage

### Getting Started
1. **Sign Up**: Create a new account or sign in
2. **Set Up Partner Profile**: Add your partner's preferences for personalized suggestions
3. **Start Chatting**: Use the AI chat interface to plan your dates
4. **Voice Commands**: Press and hold the microphone button to speak

### Key Features
- **Date Planning**: Ask for romantic activity suggestions with AI-powered recommendations
- **Real Events**: Browse live events from Ticketmaster and Eventbrite
- **Smart Caching**: Events are pre-loaded and cached for instant access
- **Partner Preferences**: Get personalized recommendations based on your partner's profile
- **DateFlow Generation**: Create detailed, step-by-step date itineraries
- **Email Invitations**: Send beautiful DateFlow invitations with calendar attachments
- **Conversation History**: Review your previous planning sessions
- **Voice Commands**: Use natural speech to interact with the AI
- **Event Refresh**: Update events with loading animations and cache management

## 🔧 API Endpoints

### Chat & AI
- `POST /chat` - Send message to AI (authenticated)
- `POST /chat/guest` - Send message to AI (guest)
- `POST /chat/generate-dateflow` - Generate DateFlow itinerary
- `POST /chat/transcribe` - Speech-to-text
- `POST /chat/synthesize` - Text-to-speech
- `GET /chat/events` - Get live events
- `GET /chat/date-ideas` - Get AI-generated date ideas

### User Management
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile
- `GET /user/events` - Get cached events for user
- `POST /user/partner-profile` - Set partner profile

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/verify-email` - Email verification

## 🎨 Design

DateFlow AI features a modern, enterprise-level design with:
- **Black Theme**: Sleek, professional appearance
- **Glassmorphism Effects**: Modern UI with backdrop blur
- **Responsive Design**: Works on all devices
- **Smooth Animations**: Premium user experience
- **Professional Typography**: Clean, readable fonts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Groq** for AI language model capabilities
- **Deepgram** for voice processing services
- **React** and **Node.js** communities for excellent documentation
- **MongoDB** for database solutions

## 📞 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Check the documentation
- Contact the development team

## 🧪 Testing

The application includes comprehensive testing capabilities:

### Chat Tab Testing
```bash
# Test the chat functionality with multiple utterances
node test-chat-tab.js
```

This test script:
- Authenticates with your credentials
- Tests multiple chat messages
- Verifies AI responses are concise and relevant
- Tests event loading and caching
- Validates profile context integration

### Manual Testing
1. **Chat Tab**: Test AI responses with various date planning requests
2. **Events Tab**: Verify event loading, caching, and refresh functionality
3. **DateFlow Generation**: Test complete date itinerary creation
4. **Email Invitations**: Test DateFlow email sending with calendar attachments
5. **Voice Features**: Test speech-to-text and text-to-speech functionality

## 🔮 Future Features

- [ ] Mobile app development
- [ ] Calendar integration
- [ ] Social features
- [ ] Advanced AI personalization
- [ ] Multi-language support
- [ ] Restaurant booking integration
- [ ] Event ticket purchasing
- [ ] Group date planning
- [ ] Weather integration
- [ ] Transportation recommendations

---

**DateFlow AI** - Making every date unforgettable with the power of AI.
