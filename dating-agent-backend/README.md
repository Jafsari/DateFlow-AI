# Dating Agent Backend

A Node.js/Express backend for the Dating AI Agent that handles user authentication, conversation storage, and date planning assistance.

## 🚀 Features

- **User Authentication**: JWT-based authentication with registration and login
- **Conversation Storage**: MongoDB-based conversation history with context
- **Date Planning Focus**: Specialized for date planning advice and logistics
- **RESTful API**: Clean API endpoints for frontend integration
- **Security**: Password hashing, JWT tokens, and input validation

## 📁 Project Structure

```
dating-agent-backend/
├── models/
│   ├── User.js          # User model with profile and preferences
│   └── Conversation.js  # Conversation model with context
├── routes/
│   ├── auth.js          # Authentication endpoints
│   ├── chat.js          # Chat/conversation endpoints
│   └── user.js          # User profile management
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── server.js            # Main server file
├── test-api.js          # Database testing script
└── .env                 # Environment variables
```

## 🔧 Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   ```

3. **Start the server**:
   ```bash
   npm run dev  # Development mode with nodemon
   npm start    # Production mode
   ```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Chat
- `POST /api/chat` - Send message and get AI response
- `GET /api/chat/conversations` - Get user's conversation history
- `GET /api/chat/conversation/:sessionId` - Get specific conversation

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `POST /api/user/date-history` - Add date to history
- `GET /api/user/date-history` - Get date history
- `DELETE /api/user/delete-account` - Delete account

### Health Check
- `GET /health` - Server health status

## 🗄️ Database Models

### User Model
```javascript
{
  email: String,
  password_hash: String,
  profile: {
    name: String,
    location: String,
    preferences: {
      budget_range: String,
      activity_types: [String],
      transportation: String,
      time_preferences: [String],
      dietary_restrictions: [String]
    }
  },
  date_history: [Object],
  created_at: Date,
  last_active: Date
}
```

### Conversation Model
```javascript
{
  user_id: ObjectId,
  session_id: String,
  messages: [{
    role: String,
    content: String,
    timestamp: Date
  }],
  context: {
    current_topic: String,
    user_mood: String,
    conversation_summary: String,
    key_insights: [String],
    date_planning_context: Object
  },
  created_at: Date,
  updated_at: Date,
  expires_at: Date // TTL for auto-cleanup
}
```

## 🔐 Authentication

The API uses JWT tokens for authentication:

1. **Register/Login** → Get JWT token
2. **Include token** in Authorization header: `Bearer <token>`
3. **Token expires** after 7 days (configurable)

## 🧪 Testing

### Test Database Connection
```bash
node test-api.js
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:5001/health

# Register user (requires MongoDB)
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Send chat message (requires authentication)
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"Help me plan a first date","session_id":"test123"}'
```

## 🚦 Current Status

✅ **Completed**:
- Express server setup
- MongoDB models and schemas
- Authentication system
- Chat/conversation endpoints
- User management
- Error handling and logging
- API testing

⚠️ **Needs MongoDB**:
- Database connection required for full functionality
- Install MongoDB locally or use MongoDB Atlas

## 🔮 Next Steps

1. **Database Setup**: Install MongoDB or configure MongoDB Atlas
2. **OpenAI Integration**: Replace simple AI responses with OpenAI API
3. **Deepgram Integration**: Add speech-to-text capabilities
4. **Frontend Integration**: Connect with React frontend
5. **Production Deployment**: Deploy to cloud platform

## 📝 Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/dating-agent
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 🛠️ Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT authentication
- **cors**: Cross-origin resource sharing
- **helmet**: Security middleware
- **morgan**: HTTP request logger
- **dotenv**: Environment variables
