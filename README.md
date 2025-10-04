# DateFlow AI - Intelligent Dating Assistant

DateFlow AI is a sophisticated dating assistant application that helps users plan amazing dates, find restaurants, and create memorable experiences. Built with modern web technologies and powered by AI, it provides personalized recommendations and seamless voice interaction.

## 🚀 Features

### Core Functionality
- **AI-Powered Date Planning**: Get intelligent suggestions for romantic activities and experiences
- **Restaurant Recommendations**: Find the perfect dining spots with detailed information
- **Voice Interaction**: Natural voice commands with text-to-speech responses
- **Partner Profile Management**: Store and use partner preferences for personalized suggestions
- **Conversation History**: Keep track of your planning sessions
- **Real-time Chat**: Interactive chat interface with AI assistant

### Technical Features
- **Modern React Frontend**: Beautiful, responsive user interface
- **Node.js Backend**: Robust API with Express.js
- **AI Integration**: Powered by Groq API for intelligent responses
- **Voice Processing**: Deepgram integration for speech-to-text and text-to-speech
- **Authentication**: Secure user authentication and session management
- **Database**: MongoDB with Mongoose for data persistence

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
- **Groq API** - AI language model
- **Deepgram** - Speech-to-text and text-to-speech
- **Web Audio API** - Voice processing

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
   
   Create a `.env` file in the `dating-agent-backend` directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/dateflow-ai
   JWT_SECRET=your-jwt-secret-key
   GROQ_API_KEY=your-groq-api-key
   DEEPGRAM_API_KEY=your-deepgram-api-key
   EMAIL_SERVICE_API_KEY=your-email-service-key
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
- **Date Planning**: Ask for romantic activity suggestions
- **Restaurant Search**: Find restaurants by cuisine, location, or occasion
- **Partner Preferences**: Get personalized recommendations based on your partner's profile
- **Conversation History**: Review your previous planning sessions
- **Quick Suggestions**: Use the quick action buttons for common requests

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Email verification

### Chat
- `POST /api/chat` - Send message to AI
- `POST /api/chat/transcribe` - Speech-to-text
- `POST /api/chat/synthesize` - Text-to-speech
- `GET /api/chat/conversations` - Get conversation history

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `POST /api/user/partner-profile` - Set partner profile

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

## 🔮 Future Features

- [ ] Mobile app development
- [ ] Calendar integration
- [ ] Social features
- [ ] Advanced AI personalization
- [ ] Multi-language support
- [ ] Restaurant booking integration

---

**DateFlow AI** - Making every date unforgettable with the power of AI.
