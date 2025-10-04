const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  session_id: {
    type: String,
    required: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  context: {
    current_topic: {
      type: String,
      default: 'date_planning'
    },
    user_mood: {
      type: String,
      enum: ['excited', 'nervous', 'confident', 'uncertain', 'neutral']
    },
    conversation_summary: String,
    key_insights: [String],
    date_planning_context: {
      date_type: {
        type: String,
        enum: ['first_date', 'second_date', 'anniversary', 'casual', 'special_occasion']
      },
      partner_preferences: {
        interests: [String],
        dietary: String,
        location_preference: String
      },
      constraints: {
        budget: String,
        time_available: String,
        transportation: String,
        weather: String
      }
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  expires_at: {
    type: Date,
    default: function() {
      // Auto-expire after 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
});

// Update the updated_at field before saving
conversationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// TTL index for auto-cleanup
conversationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Index for efficient queries
conversationSchema.index({ user_id: 1, session_id: 1 });
conversationSchema.index({ user_id: 1, updated_at: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
