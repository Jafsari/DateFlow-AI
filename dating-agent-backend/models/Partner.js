const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    min: 18,
    max: 100
  },
  location: {
    type: String,
    trim: true
  },
  photos: [{
    url: String,
    caption: String,
    is_primary: { type: Boolean, default: false }
  }],
  bio: {
    type: String,
    maxlength: 500
  },
  keywords: {
    type: String,
    maxlength: 1000
  },
  dietaryRestrictions: {
    type: String,
    maxlength: 500
  },
  budget: {
    type: String,
    enum: ['budget', 'moderate', 'upscale', 'luxury'],
    default: 'moderate'
  },
  interests: [{
    type: String,
    enum: [
      'travel', 'music', 'sports', 'art', 'reading', 'movies', 'cooking', 
      'fitness', 'photography', 'gaming', 'dancing', 'hiking', 'yoga',
      'technology', 'fashion', 'animals', 'volunteering', 'writing',
      'gardening', 'wine', 'crafts', 'outdoor', 'indoor', 'social'
    ]
  }],
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
  preferences: {
    age_range: {
      min: { type: Number, min: 18, default: 21 },
      max: { type: Number, max: 100, default: 35 }
    },
    distance_radius: {
      type: Number,
      default: 25, // miles
      min: 1,
      max: 100
    },
    cuisine_preferences: [{
      type: String,
      enum: [
        'italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai', 'french',
        'american', 'mediterranean', 'korean', 'vietnamese', 'greek', 'spanish',
        'german', 'middle_eastern', 'soul_food', 'seafood', 'steakhouse',
        'vegetarian', 'vegan', 'healthy', 'fast_food', 'food_trucks', 'fine_dining'
      ]
    }],
    activity_preferences: [{
      type: String,
      enum: [
        'coffee_dates', 'restaurants', 'bars', 'museums', 'concerts', 'theater',
        'movies', 'hiking', 'beach', 'sports', 'gaming', 'shopping', 'art_galleries',
        'cooking_classes', 'wine_tasting', 'dance', 'yoga', 'fitness', 'travel',
        'outdoor_adventures', 'indoor_games', 'live_music', 'comedy_shows'
      ]
    }],
    date_timing: {
      weekdays: { type: Boolean, default: true },
      weekends: { type: Boolean, default: true },
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: true },
      evening: { type: Boolean, default: true },
      late_night: { type: Boolean, default: false }
    },
    budget_preferences: {
      type: String,
      enum: ['$', '$$', '$$$', '$$$$'],
      default: '$$'
    },
    transportation: {
      type: String,
      enum: ['car', 'public', 'walking', 'bike', 'flexible'],
      default: 'flexible'
    }
  },
  personality_traits: {
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
  deal_breakers: [{
    type: String,
    enum: [
      'smoking', 'heavy_drinking', 'no_job', 'no_education', 'has_children',
      'doesnt_want_children', 'different_religion', 'different_politics',
      'no_ambition', 'poor_hygiene', 'bad_communication', 'dishonest'
    ]
  }],
  must_haves: [{
    type: String,
    enum: [
      'good_sense_of_humor', 'ambitious', 'family_oriented', 'adventurous',
      'intelligent', 'emotionally_available', 'financially_stable', 'kind',
      'good_communication', 'similar_interests', 'active_lifestyle', 'creative'
    ]
  }],
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  is_active: {
    type: Boolean,
    default: true
  }
});

// Update the updated_at field before saving
partnerSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Index for efficient querying
partnerSchema.index({ user_id: 1 });
partnerSchema.index({ location: 1 });
partnerSchema.index({ 'lifestyle.relationship_goals': 1 });
partnerSchema.index({ created_at: -1 });

module.exports = mongoose.model('Partner', partnerSchema);
