const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  profile: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      min: 18,
      max: 100
    },
    bio: {
      type: String,
      maxlength: 500,
      trim: true
    },
    neighborhood: {
      type: String,
      required: true,
      trim: true
    },
    travel_radius: {
      type: Number,
      min: 1,
      max: 100,
      default: 10
    },
    relationship_status: {
      type: String,
      enum: ['single', 'dating', 'in_relationship', 'engaged', 'married', ''],
      default: 'single'
    },
    interests: [{
      type: String,
      trim: true
    }],
    budget: {
      type: String,
      enum: ['$20-40', '$40-80', '$80-150', '$150-300', '$300+', '']
    },
    preferences: {
      budget_range: {
        type: String,
        enum: ['$', '$$', '$$$', '$$$$'],
        default: '$$'
      },
      activity_types: [{
        type: String,
        enum: ['outdoor', 'cultural', 'food', 'entertainment', 'sports', 'relaxation']
      }],
      transportation: {
        type: String,
        enum: ['car', 'public', 'walking', 'bike'],
        default: 'public'
      },
      time_preferences: [{
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'weekend']
      }],
      dietary_restrictions: [String],
      accessibility_needs: [String],
      cuisine_preferences: [{
        type: String,
        enum: [
          'italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai', 'french',
          'american', 'mediterranean', 'korean', 'vietnamese', 'greek', 'spanish',
          'german', 'middle_eastern', 'soul_food', 'seafood', 'steakhouse',
          'vegetarian', 'vegan', 'healthy', 'fast_food', 'food_trucks', 'fine_dining'
        ]
      }],
      date_activities: [{
        type: String,
        enum: [
          'coffee_dates', 'restaurants', 'bars', 'museums', 'concerts', 'theater',
          'movies', 'hiking', 'beach', 'sports', 'gaming', 'shopping', 'art_galleries',
          'cooking_classes', 'wine_tasting', 'dance', 'yoga', 'fitness', 'travel',
          'outdoor_adventures', 'indoor_games', 'live_music', 'comedy_shows'
        ]
      }]
    },
    lifestyle: {
      occupation: String,
      education: {
        type: String,
        enum: ['high_school', 'some_college', 'bachelors', 'masters', 'phd', 'other']
      },
      relationship_goals: {
        type: String,
        enum: ['casual_dating', 'serious_relationship', 'marriage', 'friendship', 'not_sure']
      },
      has_children: {
        type: String,
        enum: ['no', 'yes', 'prefer_not_to_say']
      },
      wants_children: {
        type: String,
        enum: ['no', 'yes', 'maybe', 'prefer_not_to_say']
      },
      smoking: {
        type: String,
        enum: ['never', 'occasionally', 'regularly', 'prefer_not_to_say']
      },
      drinking: {
        type: String,
        enum: ['never', 'occasionally', 'regularly', 'prefer_not_to_say']
      },
      religion: {
        type: String,
        enum: ['christian', 'muslim', 'jewish', 'hindu', 'buddhist', 'atheist', 'agnostic', 'other', 'prefer_not_to_say']
      },
      politics: {
        type: String,
        enum: ['liberal', 'conservative', 'moderate', 'apolitical', 'prefer_not_to_say']
      }
    },
    personality: {
      introversion_level: {
        type: Number,
        min: 1,
        max: 10,
        default: 5 // 1 = very introverted, 10 = very extroverted
      },
      adventurousness: {
        type: Number,
        min: 1,
        max: 10,
        default: 5 // 1 = very conservative, 10 = very adventurous
      },
      spontaneity: {
        type: Number,
        min: 1,
        max: 10,
        default: 5 // 1 = very planned, 10 = very spontaneous
      },
      communication_style: {
        type: String,
        enum: ['direct', 'subtle', 'playful', 'serious', 'mixed'],
        default: 'mixed'
      },
      love_languages: [{
        type: String,
        enum: ['words_of_affirmation', 'acts_of_service', 'receiving_gifts', 'quality_time', 'physical_touch']
      }]
    },
    date_preferences: {
      budget_range: {
        type: String,
        enum: ['$', '$$', '$$$', '$$$$'],
        default: '$$'
      },
      date_types: [{
        type: String,
        enum: [
          'romantic_dinner', 'casual_lunch', 'coffee_date', 'outdoor_adventure',
          'cultural_event', 'concert', 'theater', 'movie', 'museum', 'art_gallery',
          'wine_tasting', 'cooking_class', 'dance_class', 'sports_event',
          'beach_day', 'hiking', 'picnic', 'shopping', 'gaming', 'comedy_show'
        ]
      }],
      time_preferences: {
        weekdays: { type: Boolean, default: true },
        weekends: { type: Boolean, default: true },
        morning: { type: Boolean, default: false },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true },
        late_night: { type: Boolean, default: false }
      },
      location_preferences: {
        radius_miles: { type: Number, default: 25, min: 1, max: 100 },
        preferred_areas: [String],
        avoid_areas: [String]
      },
      special_occasions: [{
        type: String,
        enum: [
          'anniversary', 'birthday', 'first_date', 'valentines_day',
          'christmas', 'new_year', 'graduation', 'promotion', 'just_because'
        ]
      }]
    }
  },
  date_history: [{
    date_id: String,
    activity: String,
    location: String,
    date: Date,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    notes: String
  }],
  created_at: {
    type: Date,
    default: Date.now
  },
  last_active: {
    type: Date,
    default: Date.now
  },
  email_verified: {
    type: Boolean,
    default: false
  },
  email_verification_token: {
    type: String,
    default: null
  },
  email_verification_expires: {
    type: Date,
    default: null
  },
  // Resy integration fields
  resyConnected: {
    type: Boolean,
    default: false
  },
  resyEmail: {
    type: String,
    default: null
  },
  resyToken: {
    type: String,
    default: null
  },
  resyConnectedAt: {
    type: Date,
    default: null
  },
  // Partner reference
  active_partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

// Update last_active timestamp
userSchema.methods.updateLastActive = function() {
  this.last_active = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
