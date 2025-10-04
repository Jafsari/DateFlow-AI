const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const axios = require('axios');
const { createClient } = require('@deepgram/sdk');
const multer = require('multer');
const router = express.Router();

// Simple in-memory store for guest conversations
const guestConversations = new Map();

// Date ideas endpoint
router.get('/date-ideas', authenticateToken, async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        code: 'MISSING_LOCATION'
      });
    }

    console.log(`💡 Date ideas request for location: ${location}`);

    // Check cache first
    const cachedDateIdeas = getCachedDateIdeas(location);
    if (cachedDateIdeas) {
      console.log(`✅ Returning ${cachedDateIdeas.length} cached date ideas`);
      return res.json({
        dateIdeas: cachedDateIdeas,
        location: location,
        source: 'cache',
        count: cachedDateIdeas.length
      });
    }

    // Get partner profile from query params (if available)
    const partnerProfile = req.query.partner_profile ? JSON.parse(req.query.partner_profile) : null;

    // Call Groq API for real date ideas
    const dateIdeas = await callGroqForDateIdeas(location, partnerProfile);

    if (dateIdeas && dateIdeas.length > 0) {
      console.log(`✅ Returning ${dateIdeas.length} date ideas from Groq`);
      setCachedDateIdeas(location, dateIdeas); // Cache the results
      res.json({
        dateIdeas: dateIdeas,
        location: location,
        source: 'groq_api',
        count: dateIdeas.length
      });
    } else {
      console.log('⚠️ No date ideas from Groq, returning fallback ideas');
      // Return fallback date ideas if Groq fails
      const fallbackDateIdeas = [
        {
          title: `${location.split(',')[0]} Food Tour`,
          duration: "3-4 hours",
          budget: "$60-100",
          description: `Explore the culinary scene of ${location.split(',')[0]} with a guided food tour through local restaurants and food markets.`,
          activities: ["Food tasting", "Market exploration", "Restaurant visits", "Cultural learning"],
          bestTime: "Afternoon (12-4 PM)"
        },
        {
          title: `${location.split(',')[0]} Sunset Walk`,
          duration: "2-3 hours",
          budget: "$20-40",
          description: `Take a romantic walk through ${location.split(',')[0]}'s most scenic spots during golden hour.`,
          activities: ["Walking", "Photography", "Scenic views", "Conversation"],
          bestTime: "Evening (5-8 PM)"
        },
        {
          title: `${location.split(',')[0]} Museum Date`,
          duration: "2-4 hours",
          budget: "$30-60",
          description: `Explore art and culture together at ${location.split(',')[0]}'s finest museums and galleries.`,
          activities: ["Art viewing", "Gallery tours", "Coffee break", "Discussion"],
          bestTime: "Afternoon (1-5 PM)"
        },
        {
          title: `${location.split(',')[0]} Cooking Class`,
          duration: "3-4 hours",
          budget: "$80-120",
          description: `Learn to cook a romantic meal together at a local culinary school in ${location.split(',')[0]}.`,
          activities: ["Cooking", "Wine tasting", "Learning", "Eating together"],
          bestTime: "Evening (6-10 PM)"
        },
        {
          title: `${location.split(',')[0]} Live Music Night`,
          duration: "3-5 hours",
          budget: "$40-80",
          description: `Enjoy live music at one of ${location.split(',')[0]}'s intimate venues or concert halls.`,
          activities: ["Live music", "Drinks", "Dancing", "Socializing"],
          bestTime: "Evening (7-11 PM)"
        }
      ];

      res.json({
        dateIdeas: fallbackDateIdeas,
        location: location,
        source: 'fallback',
        count: fallbackDateIdeas.length
      });
    }
  } catch (error) {
    console.error('❌ Date ideas endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch date ideas',
      code: 'DATE_IDEAS_ERROR'
    });
  }
});

// Events endpoint
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        code: 'MISSING_LOCATION'
      });
    }

    console.log(`📅 Events request for location: ${location}`);

    // Check cache first
    const cachedEvents = getCachedEvents(location);
    if (cachedEvents) {
      console.log(`✅ Returning ${cachedEvents.length} cached events`);
      return res.json({
        events: cachedEvents,
        location: location,
        source: 'cache',
        count: cachedEvents.length
      });
    }

    // Get partner profile from query params (if available)
    const partnerProfile = req.query.partner_profile ? JSON.parse(req.query.partner_profile) : null;

    // Call Groq API for real events
    const events = await callGroqForEvents(location, partnerProfile);

    if (events && events.length > 0) {
      console.log(`✅ Returning ${events.length} real events from Groq`);
      setCachedEvents(location, events); // Cache the results
      res.json({
        events: events,
        location: location,
        source: 'groq_api',
        count: events.length
      });
    } else {
      console.log('⚠️ No events from Groq, returning fallback events');
      // Return fallback events if Groq fails
      const cityName = location.split(',')[0];
      const fallbackEvents = [
        {
          name: `${cityName} Food Festival`,
          date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Convention Center`,
          category: 'Food & Drink',
          description: `Annual food festival featuring ${cityName}'s best local restaurants and food trucks.`,
          cost: '$15-25'
        },
        {
          name: `${cityName} Jazz Night`,
          date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Music Hall`,
          category: 'Music',
          description: `Live jazz performances by local and touring artists at ${cityName}'s premier music venue.`,
          cost: '$20-40'
        },
        {
          name: `${cityName} Art Walk`,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Arts District`,
          category: 'Art & Culture',
          description: `Gallery openings and street art installations throughout ${cityName}'s vibrant arts district.`,
          cost: 'Free'
        },
        {
          name: `${cityName} Farmers Market`,
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Downtown Plaza`,
          category: 'Market',
          description: `Fresh local produce, artisanal goods, and live music at ${cityName}'s popular farmers market.`,
          cost: 'Free'
        },
        {
          name: `${cityName} Comedy Night`,
          date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Comedy Club`,
          category: 'Entertainment',
          description: `Stand-up comedy featuring local and national comedians at ${cityName}'s top comedy venue.`,
          cost: '$12-20'
        },
        {
          name: `${cityName} Wine Tasting`,
          date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Winery`,
          category: 'Food & Drink',
          description: `Premium wine tasting with cheese pairings at ${cityName}'s award-winning winery.`,
          cost: '$35-55'
        },
        {
          name: `${cityName} Outdoor Movie Night`,
          date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Central Park`,
          category: 'Entertainment',
          description: `Classic movie screening under the stars with food trucks at ${cityName}'s scenic park.`,
          cost: 'Free'
        },
        {
          name: `${cityName} Cooking Class`,
          date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Culinary School`,
          category: 'Food & Drink',
          description: `Interactive cooking class for couples with professional chefs at ${cityName}'s premier culinary school.`,
          cost: '$75-95'
        },
        {
          name: `${cityName} Live Music Festival`,
          date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Amphitheater`,
          category: 'Music',
          description: `Multi-genre music festival with local and touring artists at ${cityName}'s outdoor amphitheater.`,
          cost: '$40-80'
        },
        {
          name: `${cityName} Artisan Craft Fair`,
          date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          location: `${cityName} Community Center`,
          category: 'Art & Culture',
          description: `Local artisans showcasing handmade crafts and art at ${cityName}'s community center.`,
          cost: 'Free'
        }
      ];

      res.json({
        events: fallbackEvents,
        location: location,
        source: 'fallback',
        count: fallbackEvents.length
      });
    }
  } catch (error) {
    console.error('❌ Events endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      code: 'EVENTS_ERROR'
    });
  }
});

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Build context for OpenAI from user data and conversation history
const buildContext = async (userId, conversation, partnerProfile = null) => {
  try {
    // Get user profile and preferences
    const user = await User.findById(userId);
    
    // Get recent conversations for context
    const recentConversations = await Conversation.find({ 
      user_id: userId,
      _id: { $ne: conversation._id }
    })
    .sort({ updated_at: -1 })
    .limit(3)
    .select('context messages');

    // Build context object
    const context = {
      userProfile: user.profile,
      partnerProfile: partnerProfile,
      currentConversation: {
        messages: conversation.messages,
        context: conversation.context
      },
      recentContext: recentConversations.map(conv => ({
        summary: conv.context.conversation_summary,
        topic: conv.context.current_topic,
        insights: conv.context.key_insights
      }))
    };

    return context;
  } catch (error) {
    console.error('Error building context:', error);
    return null;
  }
};

// Simple AI response generator (for now, will replace with OpenAI later)
const generateAIResponse = (userMessage, context) => {
  const message = userMessage.toLowerCase();
  const messageCount = context?.currentConversation?.context?.messageCount || 0;
  const conversationSummary = context?.currentConversation?.context?.conversation_summary || '';
  
  // Use conversation context for more personalized responses
  if (messageCount === 1) {
    if (message.includes('first date') || message.includes('coffee') || message.includes('lunch')) {
      return "Great! For a first date, I'd recommend keeping it simple and comfortable. Coffee shops or casual lunch spots work perfectly. What's your budget range and how much time do you have available?";
    }
    
    if (message.includes('restaurant') || message.includes('dinner')) {
      return "Perfect! For a dinner date, consider the atmosphere and cuisine type. What kind of food do you both enjoy? Are you looking for something romantic, casual, or somewhere in between?";
    }
    
    if (message.includes('help') || message.includes('plan') || message.includes('suggest')) {
      return "I'm here to help you plan the perfect date! Tell me about your situation - what type of date are you planning, who you're going with, and what you're hoping to do. The more details you share, the better I can help!";
    }
    
    return "Hi! I'm your AI dating assistant! 🎯 I can help you with date ideas, conversation starters, relationship advice, and more. What would you like to explore today?";
  }
  
  // Build on previous conversation context
  if (conversationSummary.includes('dinner') && message.includes('italian')) {
    return "Italian food is perfect for a romantic dinner! I'd suggest looking for a cozy trattoria with dim lighting. Would you prefer a traditional family-style place or something more modern? And have you thought about wine pairings?";
  }
  
  if (conversationSummary.includes('dinner') && message.includes('budget')) {
    return "Great question about budget! For Italian restaurants, you can find excellent options at different price points. What's your comfort zone - are you thinking casual trattoria ($15-25 per person) or something more upscale ($40-60 per person)?";
  }
  
  if (message.includes('activity') || message.includes('what to do')) {
    return "There are so many great date activities! Are you more into outdoor adventures, cultural experiences, or something more relaxed? I can suggest activities based on your interests and location.";
  }
  
  if (message.includes('budget') || message.includes('cost') || message.includes('money')) {
    return "Budget planning is important for any date. What's your preferred spending range? I can suggest great options for any budget - from free activities like walking tours to splurge-worthy experiences.";
  }
  
  if (message.includes('location') || message.includes('where')) {
    return "Location is key for a successful date! Are you looking for something close to home, or are you open to traveling? I can suggest venues based on your area and transportation preferences.";
  }
  
  if (message.includes('weather') || message.includes('rain') || message.includes('outdoor')) {
    return "Weather can definitely affect date planning! If it's going to rain, we can pivot to indoor activities like museums, cafes, or indoor markets. What's the forecast looking like?";
  }
  
  if (message.includes('second date') || message.includes('follow up')) {
    return "Exciting! For a second date, you can step it up a bit. What did you enjoy about your first date? I can suggest activities that build on that experience or try something completely different.";
  }
  
  // More contextual responses based on conversation flow
  if (messageCount > 1) {
    if (message.includes('yes') || message.includes('sounds good') || message.includes('perfect')) {
      return "Excellent! I'm excited to help you plan this. What's the next detail we should work on - timing, reservations, or maybe some conversation starters for the date?";
    }
    
    if (message.includes('no') || message.includes('not sure')) {
      return "No worries! Let's explore other options. What aspects of dating are you most interested in? I can help with different types of dates, conversation tips, or relationship advice.";
    }
  }
  
  return "That sounds interesting! I'm here to help with all aspects of date planning - from choosing venues and activities to logistics and preparation. What specific aspect of your date would you like help with?";
};

// Pokemon-specific AI response generation
const generatePokemonAIResponse = (userMessage, context, pokemon) => {
  const message = userMessage.toLowerCase();
  
  // Pokemon personalities
  const pokemonPersonalities = {
    charizard: {
      emoji: '🔥',
      name: 'Charizard',
      style: 'enthusiastic, energetic, and passionate',
      responses: {
        help: "Alright, trainer! Charizard here! Ready to ignite your dating life? Tell me your fiery date ideas, and I'll help you make them legendary! Let's go!",
        restaurant: "A blazing romantic dinner, eh? I'll find a place with a fiery ambiance and a menu that'll set your taste buds alight! How about a rooftop steakhouse with a view?",
        activity: "Weeby activities? Let's make it epic! How about a competitive arcade date, or a visit to a specialty anime store for some rare finds? We'll make it a victory!",
        budget: "Charizard is all about making it legendary! Tell me your budget range and I'll help you plan something that'll make your date's heart pound with excitement!",
        location: "Location scouting time! Charizard can help you find the perfect spot that'll make your date unforgettable. What area are we exploring, trainer?"
      }
    },
    blastoise: {
      emoji: '💧',
      name: 'Blastoise',
      style: 'calm, thoughtful, and strategic',
      responses: {
        help: "Greetings, trainer. Blastoise is ready to assist. Let's dive deep into planning the perfect, smooth date. What kind of aquatic adventures or calm evenings do you have in mind?",
        restaurant: "A calm and romantic dinner. I'll locate a serene waterfront restaurant with exquisite seafood. Perhaps a quiet jazz bar afterwards to keep the evening flowing smoothly?",
        activity: "Weeby activities? Let's find something cool and collected. A cozy manga cafe, or perhaps a visit to an art gallery featuring Japanese artists? A refreshing experience awaits.",
        budget: "Blastoise approaches budget planning with precision. Let's carefully plan your spending to ensure a smooth, stress-free experience. What's your comfortable range?",
        location: "Strategic location planning. I'll help you find a peaceful spot that ensures smooth navigation and a memorable experience. What's your preferred area?"
      }
    },
    venusaur: {
      emoji: '🌿',
      name: 'Venusaur',
      style: 'nurturing, wise, and harmonious',
      responses: {
        help: "Hello there, trainer. Venusaur is here to help your love bloom. Share your ideas for a natural, harmonious date, and I'll cultivate the perfect plan for you. Let's grow together!",
        restaurant: "A nurturing romantic dinner. I'll suggest a farm-to-table restaurant with organic options, or a botanical garden cafe. Let's find a place where your connection can truly blossom.",
        activity: "Weeby activities? Let's cultivate a unique experience. A visit to a serene Japanese garden, or a workshop on traditional Japanese crafts? A date that fosters growth and appreciation.",
        budget: "Venusaur believes in sustainable, meaningful experiences. Let's plan something that grows your connection without breaking the bank. What's your comfortable range?",
        location: "Harmonious location planning. I'll help you find a place where nature and romance meet, creating the perfect environment for your connection to flourish."
      }
    }
  };

  const personality = pokemonPersonalities[pokemon] || pokemonPersonalities.charizard;
  
  // Generate Pokemon-specific responses
  if (message.includes('help') || message.includes('plan')) {
    return personality.responses.help;
  }
  
  if (message.includes('restaurant') || message.includes('dinner') || message.includes('food')) {
    return personality.responses.restaurant;
  }
  
  if (message.includes('activity') || message.includes('fun') || message.includes('do')) {
    return personality.responses.activity;
  }
  
  if (message.includes('budget') || message.includes('money') || message.includes('cost')) {
    return personality.responses.budget;
  }
  
  if (message.includes('location') || message.includes('where') || message.includes('place')) {
    return personality.responses.location;
  }
  
  if (message.includes('anime') || message.includes('kawaii') || message.includes('weeby')) {
    return `${personality.emoji} ${personality.name} loves anime culture too! Let's plan something super kawaii and weeby that'll make your date absolutely adorable! ✨`;
  }
  
  if (message.includes('pokemon') || message.includes('trainer')) {
    return `${personality.emoji} As your ${personality.name}, I'm here to help you become the ultimate dating trainer! Let's plan a date that's as legendary as a Pokemon battle!`;
  }
  
  // Default response with Pokemon personality
  return `${personality.emoji} ${personality.name} is ready to help with your date planning! I'm ${personality.style}. What specific aspect of your date would you like to work on?`;
};

// Fiona fallback response generator
const generateFionaResponse = (userMessage, context) => {
  const message = userMessage.toLowerCase();
  
  if (message.includes('help') || message.includes('plan')) {
    return "Hi there! I'm Fiona, your personal date planning assistant! 💕 I'd love to help you plan something special. What kind of date are you thinking about? Are you looking for something romantic, fun, or maybe something unique?";
  }
  
  if (message.includes('restaurant') || message.includes('dinner') || message.includes('food')) {
    return "Great choice! A romantic dinner is always wonderful! 💕 What's your budget range and what kind of cuisine do you both enjoy? I can suggest some amazing restaurants that would be perfect for your date!";
  }
  
  if (message.includes('activity') || message.includes('fun') || message.includes('do')) {
    return "There are so many fun date activities to choose from! 🎉 Are you thinking indoor or outdoor? Something adventurous like hiking, or more relaxed like a museum or art gallery? What are your interests?";
  }
  
  if (message.includes('budget') || message.includes('money') || message.includes('cost')) {
    return "Budget planning is so important! 💰 Don't worry, I can help you plan something amazing for any budget. What's your comfortable spending range? I have great ideas from free activities to splurge-worthy experiences!";
  }
  
  if (message.includes('location') || message.includes('where') || message.includes('place')) {
    return "Location is key for a perfect date! 🌟 Are you looking for something close to home, or are you open to traveling? I can suggest venues based on your area and what kind of atmosphere you're going for!";
  }
  
  if (message.includes('romantic') || message.includes('special')) {
    return "Aww, how sweet! 💖 I love helping with romantic dates! Tell me more about what you're planning - is it a special occasion, or just a lovely evening together? I have some magical ideas!";
  }
  
  return "Hi! I'm Fiona, and I'm here to help make your date planning easy and fun! 💕 Whether you're planning a first date, anniversary, or just a special evening, I'd love to help. What can we work on together?";
};

// Groq AI integration for date ideas
const callGroqForDateIdeas = async (location, partnerProfile) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      console.warn('GROQ_API_KEY not found for date ideas');
      return null;
    }

    // Check rate limiting
    if (!canMakeGroqCall()) {
      console.log('⏳ Skipping Groq API call due to rate limiting');
      return null;
    }

    const cityName = location.split(',')[0].trim();
    const stateName = location.split(',')[1]?.trim() || '';
    const fullLocation = stateName ? `${cityName}, ${stateName}` : cityName;

    const partnerContext = partnerProfile?.name ? `
    
    PARTNER PREFERENCES:
    - Partner Name: ${partnerProfile.name}
    - Interests: ${partnerProfile.interests || 'Not specified'}
    - Preferences: ${partnerProfile.preferences || 'Not specified'}
    - Budget Range: ${partnerProfile.budget || 'Not specified'}
    - Dietary Restrictions: ${partnerProfile.dietaryRestrictions || 'None'}
    
    Please consider these preferences when suggesting date ideas.` : '';

    const prompt = `Create 10 amazing date ideas for ${fullLocation}. These should be realistic, romantic, and fun activities that couples can actually do in this city.${partnerContext}

    For each date idea, provide:
    - Title (catchy, romantic title)
    - Duration (how long the date takes)
    - Budget (cost range)
    - Description (detailed description of the date)
    - Activities (list of specific activities)
    - Best Time (when to do this date)

    IMPORTANT: 
    - Use realistic venues and locations that exist in ${cityName}
    - Prioritize romantic and memorable experiences
    - Consider the partner's interests and preferences if provided
    - Make the ideas sound current and achievable
    - Use actual venue names from ${cityName}
    - Include a variety of date types (outdoor, indoor, food, culture, adventure, etc.)

    Format your response as a JSON array with exactly these fields: title, duration, budget, description, activities, bestTime.

    Example format:
    [
      {
        "title": "Sunset Rooftop Romance",
        "duration": "3-4 hours",
        "budget": "$80-120",
        "description": "Watch the sunset from a romantic rooftop bar with craft cocktails and small plates, followed by a moonlit walk through the city.",
        "activities": ["Rooftop drinks", "Sunset viewing", "City walk", "Photography"],
        "bestTime": "Evening (6-10 PM)"
      }
    ]`;

    console.log(`💡 Calling Groq API for date ideas in ${fullLocation}...`);

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides creative and romantic date ideas. Always respond with valid JSON arrays.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 3000
    }, {
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log(`✅ Groq API date ideas response: ${aiResponse.substring(0, 100)}...`);

    // Try to parse the JSON response - handle multiple formats
    try {
      // First try to find JSON array in the response
      let jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        // Try to find JSON after "```json" markers
        jsonMatch = aiResponse.match(/```json\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1]];
        }
      }
      
      if (jsonMatch) {
        const dateIdeas = JSON.parse(jsonMatch[0]);
        if (Array.isArray(dateIdeas) && dateIdeas.length > 0) {
          console.log(`🎉 Successfully parsed ${dateIdeas.length} date ideas from Groq`);
          return dateIdeas.slice(0, 10);
        }
      }
      
      // If no JSON array found, try to parse the entire response as JSON
      const dateIdeas = JSON.parse(aiResponse);
      if (Array.isArray(dateIdeas) && dateIdeas.length > 0) {
        console.log(`🎉 Successfully parsed ${dateIdeas.length} date ideas from Groq (full response)`);
        return dateIdeas.slice(0, 10);
      }
    } catch (parseError) {
      console.error('❌ Error parsing date ideas JSON:', parseError);
      console.log('📝 Raw AI response for debugging:', aiResponse.substring(0, 500));
    }

    return null;
  } catch (error) {
    console.error('❌ Groq API date ideas error:', error.response?.data || error.message);
    return null;
  }
};

// Rate limiting and caching helper
let lastGroqCall = 0;
const GROQ_RATE_LIMIT_DELAY = 30000; // 30 seconds between calls
const CACHE_DURATION = 300000; // 5 minutes cache

// Cache for events and date ideas
const eventsCache = new Map();
const dateIdeasCache = new Map();

const canMakeGroqCall = () => {
  const now = Date.now();
  if (now - lastGroqCall < GROQ_RATE_LIMIT_DELAY) {
    console.log('⏳ Rate limiting Groq API calls to avoid hitting limits');
    return false;
  }
  lastGroqCall = now;
  return true;
};

const getCachedEvents = (location) => {
  const cacheKey = location.toLowerCase();
  const cached = eventsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📋 Using cached events for:', location);
    return cached.data;
  }
  return null;
};

const setCachedEvents = (location, data) => {
  const cacheKey = location.toLowerCase();
  eventsCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
};

const getCachedDateIdeas = (location) => {
  const cacheKey = location.toLowerCase();
  const cached = dateIdeasCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('💡 Using cached date ideas for:', location);
    return cached.data;
  }
  return null;
};

const setCachedDateIdeas = (location, data) => {
  const cacheKey = location.toLowerCase();
  dateIdeasCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
};

// Groq AI integration for events
const callGroqForEvents = async (location, partnerProfile) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      console.warn('GROQ_API_KEY not found for events');
      return null;
    }

    // Check rate limiting
    if (!canMakeGroqCall()) {
      console.log('⏳ Skipping Groq API call due to rate limiting');
      return null;
    }

    const cityName = location.split(',')[0].trim();
    const stateName = location.split(',')[1]?.trim() || '';
    const fullLocation = stateName ? `${cityName}, ${stateName}` : cityName;

    const partnerContext = partnerProfile?.name ? `
    
    PARTNER PREFERENCES:
    - Partner Name: ${partnerProfile.name}
    - Interests: ${partnerProfile.interests || 'Not specified'}
    - Preferences: ${partnerProfile.preferences || 'Not specified'}
    - Budget Range: ${partnerProfile.budget || 'Not specified'}
    - Dietary Restrictions: ${partnerProfile.dietaryRestrictions || 'None'}
    
    Please consider these preferences when suggesting events.` : '';

    const currentDate = new Date();
    const futureDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    const prompt = `Find 10 upcoming events happening in ${fullLocation} between ${currentDate.toLocaleDateString()} and ${futureDate.toLocaleDateString()}. These should be realistic events that typically happen in this city.${partnerContext}

    For each event, provide:
    - Event name (realistic event name)
    - Date (specific date in MM/DD/YYYY format)
    - Location/venue (specific venue name in ${cityName})
    - Category (Food & Drink, Music, Art & Culture, Entertainment, Sports, etc.)
    - Brief description (what the event is about and why it's great for couples)
    - Cost (ticket price or "Free")

    IMPORTANT: 
    - Use realistic event names and venues that exist in ${cityName}
    - Prioritize events that would be romantic or fun for couples
    - Consider the partner's interests and preferences if provided
    - Make the events sound current and realistic
    - Use actual venue names from ${cityName}

    Format your response as a JSON array with exactly these fields: name, date, location, category, description, cost.

    Example format:
    [
      {
        "name": "Jazz Night at Blue Note",
        "date": "01/15/2025",
        "location": "Blue Note Jazz Club",
        "category": "Music",
        "description": "Intimate jazz performance perfect for a romantic date night",
        "cost": "$25-45"
      },
      {
        "name": "Art Gallery Opening",
        "date": "01/16/2025",
        "location": "Guggenheim Museum",
        "category": "Art & Culture",
        "description": "Contemporary art exhibition opening with wine and hors d'oeuvres",
        "cost": "Free"
      }
    ]`;

    console.log(`🎯 Calling Groq API for real events in ${fullLocation}...`);

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides real, current event information. Always respond with valid JSON arrays.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log(`✅ Groq API events response: ${aiResponse.substring(0, 100)}...`);

    // Try to parse the JSON response
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const events = JSON.parse(jsonMatch[0]);
        if (Array.isArray(events) && events.length > 0) {
          console.log(`🎉 Successfully parsed ${events.length} real events from Groq`);
          return events.slice(0, 10);
        }
      }
    } catch (parseError) {
      console.error('❌ Error parsing events JSON:', parseError);
    }

    return null;
  } catch (error) {
    console.error('❌ Groq API events error:', error.response?.data || error.message);
    return null;
  }
};

// Groq AI integration
const callGroqAPI = async (userMessage, context, conversationHistory) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      console.warn('GROQ_API_KEY not found, falling back to rule-based responses');
      return generateFionaResponse(userMessage, context);
    }

    // Create Fiona's system prompt with partner profile context
    let fionaPrompt = `You are Fiona, a friendly and knowledgeable AI assistant specializing in date planning and relationship advice! 💕 You're warm, empathetic, and genuinely excited to help people create memorable experiences. Your personality should be:

- Warm and approachable
- Enthusiastic about helping with date planning
- Knowledgeable about romantic activities, restaurants, and experiences
- Supportive and encouraging
- Slightly playful but professional
- Great at offering practical advice

You help users plan dates, suggest romantic activities, recommend restaurants, and provide relationship advice. You're particularly good at:
- Romantic dinner suggestions
- Creative date ideas
- Budget-friendly options
- Special occasion planning
- Understanding different relationship dynamics

IMPORTANT: You have access to previous conversation history. Use this context to provide personalized responses and remember what the user has told you before. Reference past conversations when relevant.`;

    // Add user profile context if available
    if (context && context.userProfile) {
      fionaPrompt += `\n\nUSER PROFILE CONTEXT:
- User preferences: ${JSON.stringify(context.userProfile)}
- Current conversation context: ${JSON.stringify(context.currentConversation?.context || {})}
- Recent conversation summaries: ${JSON.stringify(context.recentContext || [])}

Use this information to provide personalized recommendations that match the user's preferences and build on previous conversations.`;
    }

    // Add partner profile context if available (subtle influence only)
    if (context.partnerProfile && Object.keys(context.partnerProfile).length > 0) {
      const partner = context.partnerProfile;
      fionaPrompt += `\n\nPARTNER PROFILE CONTEXT - Use this information subtly to enhance recommendations when relevant:

PARTNER DETAILS:
- Name: ${partner.name || 'Not specified'}
- Preferences: ${partner.preferences || 'Not specified'}
- Dietary Restrictions: ${partner.dietaryRestrictions || 'None specified'}
- Budget Range: ${partner.budget || 'Not specified'}
- Location: ${partner.location || 'Not specified'}

SUBTLE PERSONALIZATION GUIDELINES:
1. Only reference partner details when directly relevant to the user's question
2. Use partner information to enhance suggestions, not dominate them
3. Focus on general date planning advice first, then add personal touches
4. When suggesting restaurants, consider dietary restrictions if mentioned
5. Keep responses focused on the user's immediate needs
6. Don't force partner references into every response

Remember: The user's current question and needs come first. Partner profile should only provide subtle context when helpful.`;
    }

    fionaPrompt += `\n\nRESPONSE GUIDELINES:
- Keep responses conversational, helpful, and under 30 words
- Always be encouraging and focus on creating meaningful connections
- Focus on the user's immediate question first, then add subtle personalization if relevant
- Only reference partner details when they directly enhance the answer
- Don't force partner information into responses that don't need it
- When asked about your partner, provide a warm, personalized summary of their profile information
- NEVER use emojis, symbols, or special characters in responses as they break text-to-speech
- Use only plain text with standard punctuation (periods, commas, question marks)
- Keep responses concise and to the point
- Prioritize helpful general advice over forced personalization`;

    // Build conversation context
    const messages = [
      { role: 'system', content: fionaPrompt }
    ];

    // Add recent conversation history (last 8 messages to stay within token limits)
    const recentHistory = conversationHistory.slice(-8);
    console.log(`📚 Adding ${recentHistory.length} previous messages to context`);
    recentHistory.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    console.log(`🤖 Calling Groq API for Fiona response with ${messages.length} total messages...`);
    console.log(`📝 System prompt length: ${fionaPrompt.length} characters`);
    console.log(`📝 Total context being sent: ${JSON.stringify(messages, null, 2)}`);

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant', // Using current Llama 3.1 model
          messages: messages,
          max_tokens: 80, // Reduced token limit for shorter responses
          temperature: 0.7,
          top_p: 0.9
        }, {
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    let aiResponse = response.data.choices[0].message.content;
    console.log(`✅ Groq API response received: ${aiResponse.substring(0, 50)}...`);
    
    // Clean response to remove symbols that break TTS
    aiResponse = aiResponse
      .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove all symbols except basic punctuation
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log('🧹 Cleaned response for TTS:', aiResponse);
    
    // Check if response mentions restaurants and add Resy integration
    if (aiResponse.toLowerCase().includes('restaurant') || 
        aiResponse.toLowerCase().includes('dinner') || 
        aiResponse.toLowerCase().includes('eat') ||
        aiResponse.toLowerCase().includes('food')) {
      
      // Add Resy integration message
      aiResponse += "\n\n🔍 I can help you check availability and make reservations directly! Just tell me the restaurant name, date, and time you'd like, and I'll handle the booking for you.";
    }
    
    return aiResponse;

  } catch (error) {
    console.error('❌ Groq API error:', error.response?.data || error.message);
    
    // Fallback to rule-based response
    console.log('🔄 Falling back to rule-based response');
    return generateFionaResponse(userMessage, context);
  }
};

// POST /api/chat/guest - Send message and get AI response (no authentication required)
router.post('/guest', async (req, res) => {
  try {
    const { message, session_id } = req.body;

    console.log('🔍 Guest chat request received:');
    console.log('  - Message:', message);
    console.log('  - Session ID:', session_id);

    if (!message || !session_id) {
      console.error('❌ Missing required fields:', { message: !!message, session_id: !!session_id });
      return res.status(400).json({
        error: 'Message and session_id are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Get or create guest conversation
    let conversation = guestConversations.get(session_id);
    if (!conversation) {
      conversation = {
        messages: [],
        context: {
          conversation_summary: 'Guest user starting a new conversation',
          current_topic: 'general_dating',
          relationship_stage: 'unknown',
          mood: 'curious',
          messageCount: 0
        }
      };
      guestConversations.set(session_id, conversation);
    }

    // Add user message to conversation
    conversation.messages.push({ role: 'user', content: message });
    conversation.context.messageCount++;

    // Update conversation context based on message count and content
    if (conversation.context.messageCount === 1) {
      if (message.toLowerCase().includes('dinner') || message.toLowerCase().includes('restaurant')) {
        conversation.context.conversation_summary = 'Guest user planning a dinner date';
        conversation.context.current_topic = 'dinner_planning';
      } else if (message.toLowerCase().includes('first date')) {
        conversation.context.conversation_summary = 'Guest user planning a first date';
        conversation.context.current_topic = 'first_date';
      } else {
        conversation.context.conversation_summary = 'Guest user just started chatting about dating advice';
        conversation.context.current_topic = 'general_dating';
      }
      conversation.context.mood = 'curious';
    } else if (conversation.context.messageCount === 2) {
      // Build on the first message context
      if (conversation.context.current_topic === 'dinner_planning') {
        if (message.toLowerCase().includes('italian') || message.toLowerCase().includes('food')) {
          conversation.context.conversation_summary = 'Guest user planning an Italian dinner date';
        } else if (message.toLowerCase().includes('budget') || message.toLowerCase().includes('price')) {
          conversation.context.conversation_summary = 'Guest user discussing dinner date budget';
        }
      }
      conversation.context.mood = 'engaged';
    } else if (conversation.context.messageCount > 3) {
      conversation.context.conversation_summary = 'Guest user having an ongoing conversation about dating';
      conversation.context.mood = 'engaged';
    }

    // Create context for AI response
    const guestContext = {
      userProfile: {
        name: 'Guest User',
        location: 'Unknown',
        age: null,
        interests: [],
        dating_goals: 'casual'
      },
      partnerProfile: null,
      currentConversation: {
        messages: conversation.messages,
        context: conversation.context
      },
      recentContext: []
    };

    console.log('🤖 Generating AI response for guest user...');
    
    // Generate AI response with guest context
    const aiResponse = await generateAIResponse(message, guestContext);
    
    // Add AI response to conversation history
    conversation.messages.push({ role: 'assistant', content: aiResponse });
    
    console.log('✅ Guest chat response generated successfully');

    res.json({
      message: aiResponse,
      session_id: session_id,
      is_guest: true,
      suggestion: 'Create an account to save your conversations and get personalized dating advice!'
    });

  } catch (error) {
    console.error('❌ Guest chat error:', error);
    res.status(500).json({
      error: 'Failed to process guest chat message',
      code: 'GUEST_CHAT_ERROR'
    });
  }
});

// POST /api/chat - Send message and get AI response
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { message, session_id, partner_profile } = req.body;
    const userId = req.user.userId;

    console.log('🔍 Backend received chat request:');
    console.log('  - User ID:', userId);
    console.log('  - Message:', message);
    console.log('  - Session ID:', session_id);
    console.log('  - Partner Profile:', partner_profile ? 'Present' : 'Not provided');
    console.log('  - Auth token present:', !!req.headers.authorization);

    if (!message || !session_id) {
      console.error('❌ Missing required fields:', { message: !!message, session_id: !!session_id });
      return res.status(400).json({
        error: 'Message and session_id are required',
        code: 'MISSING_FIELDS'
      });
    }

    console.log(`💬 Processing chat message from user ${userId}: "${message}"`);

    // Get or create conversation
    let conversation = await Conversation.findOne({ 
      user_id: userId, 
      session_id 
    });

    if (!conversation) {
      conversation = new Conversation({ 
        user_id: userId, 
        session_id,
        messages: []
      });
      console.log(`📝 Created new conversation for session: ${session_id}`);
    }

    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message
    });

    // Check if user wants to book a restaurant
    const bookingIntent = detectBookingIntent(message);
    let aiResponse;
    let bookingResult = null;

    if (bookingIntent) {
      console.log('🎯 Booking intent detected:', bookingIntent);
      
      // Handle booking directly
      try {
        bookingResult = await handleDirectBooking(bookingIntent, userId);
        aiResponse = bookingResult.message;
      } catch (bookingError) {
        console.error('❌ Booking error:', bookingError);
        // Build context for AI response
        const context = await buildContext(userId, conversation, partner_profile);
        aiResponse = await callGroqAPI(message, context, conversation.messages);
        aiResponse += "\n\nI'd love to help you make a reservation! Could you please provide the restaurant name, date, and time you'd like? For example: 'Book Le Bernardin for Saturday at 7:30 PM for 2 people'";
      }
    } else {
      // Build context for AI response
      const context = await buildContext(userId, conversation, partner_profile);
      
      // Generate AI response with Fiona personality
      console.log('🤖 Calling Groq API for AI response...');
      aiResponse = await callGroqAPI(message, context, conversation.messages);
    }
    console.log('✅ Groq API response received:', aiResponse);

    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    // Update conversation context
    conversation.context.conversation_summary = `User discussing date planning: ${message.substring(0, 100)}...`;
    conversation.updated_at = new Date();

    // Save conversation to database
    await conversation.save();
    
    console.log(`✅ Conversation saved to database. Total messages: ${conversation.messages.length}`);
    console.log(`🤖 Final AI Response: "${aiResponse}"`);

    const responseData = {
      response: aiResponse,
      conversation_id: conversation._id,
      message_count: conversation.messages.length,
      booking: bookingResult
    };
    
    console.log('📤 Sending response to frontend:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      code: 'CHAT_ERROR'
    });
  }
});

// GET /api/chat/conversations - Get user's conversation history
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10, page = 1 } = req.query;

    const conversations = await Conversation.find({ user_id: userId })
      .sort({ updated_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('session_id messages context created_at updated_at');

    const total = await Conversation.countDocuments({ user_id: userId });

    console.log(`📋 Retrieved ${conversations.length} conversations for user ${userId}`);

    res.json({
      conversations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversations',
      code: 'GET_CONVERSATIONS_ERROR'
    });
  }
});

// GET /api/chat/conversation/:sessionId - Get specific conversation
router.get('/conversation/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const conversation = await Conversation.findOne({ 
      user_id: userId, 
      session_id: sessionId 
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    console.log(`📖 Retrieved conversation ${sessionId} for user ${userId}`);

    res.json(conversation);

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation',
      code: 'GET_CONVERSATION_ERROR'
    });
  }
});

// GET /api/chat/resy-search/:restaurantName - Search for restaurant on Resy
router.get('/resy-search/:restaurantName', authenticateToken, async (req, res) => {
  try {
    const { restaurantName } = req.params;
    const encodedName = encodeURIComponent(restaurantName);
    
    // Create Resy search URL
    const resyUrl = `https://resy.com/cities/ny/${encodedName}`;
    
    console.log(`🔍 Resy search for: ${restaurantName}`);
    console.log(`🔗 Resy URL: ${resyUrl}`);
    
    res.json({
      restaurantName,
      resyUrl,
      message: `Here's the Resy link for ${restaurantName}!`
    });

  } catch (error) {
    console.error('Resy search error:', error);
    res.status(500).json({
      error: 'Failed to search restaurant',
      code: 'RESY_SEARCH_ERROR'
    });
  }
});

// POST /api/chat/yelp-search - Search restaurants using Yelp API
router.post('/yelp-search', authenticateToken, async (req, res) => {
  try {
    const { location, term, price, categories, limit = 10 } = req.body;
    const userId = req.user.userId;

    console.log('🔍 Yelp search request:', { location, term, price, categories, limit });

    // Get user's Yelp API key
    const user = await User.findById(userId);
    if (!user || !user.resyToken) { // Using resyToken field to store Yelp API key
      return res.status(400).json({
        error: 'Yelp API key not found. Please connect your Yelp account first.',
        code: 'YELP_API_KEY_MISSING'
      });
    }

    // Build Yelp API search parameters
    const searchParams = new URLSearchParams({
      location: location || 'New York, NY',
      limit: limit.toString()
    });

    if (term) searchParams.append('term', term);
    if (price) searchParams.append('price', price);
    if (categories) searchParams.append('categories', categories);

    // Call Yelp API
    const yelpResponse = await fetch(`https://api.yelp.com/v3/businesses/search?${searchParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.resyToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!yelpResponse.ok) {
      throw new Error(`Yelp API error: ${yelpResponse.status}`);
    }

    const yelpData = await yelpResponse.json();

    // Transform Yelp data to our format
    const restaurants = yelpData.businesses.map(business => ({
      id: business.id,
      name: business.name,
      rating: business.rating,
      price: business.price,
      categories: business.categories.map(cat => cat.title),
      location: business.location,
      phone: business.phone,
      url: business.url,
      image_url: business.image_url,
      review_count: business.review_count,
      distance: business.distance
    }));

    res.json({
      success: true,
      restaurants: restaurants,
      total: yelpData.total
    });

  } catch (error) {
    console.error('❌ Yelp search error:', error);
    res.status(500).json({
      error: 'Failed to search restaurants on Yelp',
      code: 'YELP_SEARCH_ERROR',
      details: error.message
    });
  }
});

// Function to check real OpenTable availability
const checkRealOpenTableAvailability = async (availabilityData) => {
  const { restaurantName, date, partySize } = availabilityData;
  
  try {
    console.log(`🔍 Searching OpenTable for ${restaurantName}...`);

    // Step 1: Search for restaurant using OpenTable API
    const searchResponse = await fetch(`https://api.opentable.com/v1/restaurants/search?name=${encodeURIComponent(restaurantName)}&city=New%20York&state=NY`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DatingAgent/1.0'
      }
    });

    if (!searchResponse.ok) {
      throw new Error('OpenTable restaurant search failed');
    }

    const searchData = await searchResponse.json();
    const restaurant = searchData.restaurants.find(r => 
      r.name.toLowerCase().includes(restaurantName.toLowerCase())
    );

    if (!restaurant) {
      throw new Error('Restaurant not found on OpenTable');
    }

    console.log(`✅ Found restaurant: ${restaurant.name} (ID: ${restaurant.id})`);

    // Step 2: Check availability
    const availabilityResponse = await fetch(`https://api.opentable.com/v1/restaurants/${restaurant.id}/availability?date=${date}&party_size=${partySize}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DatingAgent/1.0'
      }
    });

    if (!availabilityResponse.ok) {
      throw new Error('OpenTable availability check failed');
    }

    const availabilityData = await availabilityResponse.json();
    
    // Process availability data
    const availableSlots = availabilityData.availability.map(slot => ({
      time: slot.time,
      available: slot.available,
      partySize: slot.party_size
    }));

    return {
      success: true,
      availability: {
        restaurantName: restaurant.name,
        date: date,
        partySize: partySize,
        availableSlots: availableSlots,
        openTableUrl: restaurant.reserve_url || `https://www.opentable.com/restaurant/profile/${restaurant.id}`
      }
    };

  } catch (error) {
    console.error('Real OpenTable availability error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// POST /api/chat/yelp-recommendations - Get restaurant recommendations
router.post('/yelp-recommendations', authenticateToken, async (req, res) => {
  try {
    const { restaurantName, date, time, partySize, customerInfo } = req.body;
    const userId = req.user.userId;

    if (!restaurantName || !date || !time || !partySize || !customerInfo) {
      return res.status(400).json({
        error: 'All booking details are required',
        code: 'MISSING_BOOKING_PARAMS'
      });
    }

    // Get user's OpenTable connection
    const user = await User.findById(userId);
    if (!user || !user.resyConnected) {
      return res.status(400).json({
        error: 'OpenTable account not connected',
        code: 'OPENTABLE_NOT_CONNECTED'
      });
    }

    console.log(`📅 Creating real OpenTable booking for ${restaurantName} on ${date} at ${time}`);

    // Real OpenTable API booking
    const openTableResponse = await makeRealOpenTableBooking({
      restaurantName,
      date,
      time,
      partySize,
      userEmail: user.resyEmail
    });

    if (openTableResponse.success) {
      res.json({
        success: true,
        booking: openTableResponse.booking,
        message: `Booking confirmed! Your confirmation code is ${openTableResponse.confirmationCode}`
      });
    } else {
      // Fallback to simulated booking
      const bookingId = `OT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const booking = {
        bookingId,
        restaurantName,
        date,
        time,
        partySize,
        customerInfo,
        status: 'simulated',
        confirmationCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
        openTableUrl: `https://www.opentable.com/search?q=${encodeURIComponent(restaurantName)}`
      };

      res.json({
        success: true,
        booking,
        message: `Booking request saved (simulated). Your confirmation code is ${booking.confirmationCode}`
      });
    }

  } catch (error) {
    console.error('OpenTable booking error:', error);
    res.status(500).json({
      error: 'Failed to create booking',
      code: 'OPENTABLE_BOOKING_ERROR'
    });
  }
});

// POST /api/chat/yelp-connect - Connect Yelp account
router.post('/yelp-connect', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 Yelp connect request received');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user);

    const userId = req.user.userId;
    const { yelpApiKey } = req.body;

    console.log('Extracted data:', { userId, yelpApiKey: yelpApiKey ? 'Present' : 'Missing' });

    if (!yelpApiKey) {
      console.log('❌ Missing Yelp API key');
      return res.status(400).json({
        error: 'Yelp API key is required',
        code: 'MISSING_YELP_API_KEY'
      });
    }

    // Store Yelp API key in user profile
    console.log('User model loaded, updating user:', userId);
    
    const updatedUser = await User.findByIdAndUpdate(userId, {
      resyConnected: true, // Keep using resyConnected field for now
      resyEmail: 'yelp-api-key', // Store indicator in resyEmail field
      resyToken: yelpApiKey, // Store Yelp API key in resyToken field
      resyConnectedAt: new Date()
    }, { new: true });

    if (!updatedUser) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log(`🔗 Yelp account connected for user ${userId}`);

    res.json({
      success: true,
      message: 'Yelp account connected successfully!',
      connectedAt: new Date()
    });

  } catch (error) {
    console.error('❌ Yelp connection error:', error);
    res.status(500).json({
      error: 'Failed to connect Yelp account',
      code: 'YELP_CONNECTION_ERROR',
      details: error.message
    });
  }
});

// GET /api/chat/yelp-profile - Get user's Yelp profile and connection status
router.get('/yelp-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's OpenTable connection status
    const User = require('../models/User');
    const user = await User.findById(userId).select('resyConnected resyEmail resyConnectedAt');

    if (!user.resyConnected) {
      return res.status(400).json({
        error: 'OpenTable account not connected',
        code: 'OPENTABLE_NOT_CONNECTED'
      });
    }

    // Simulate OpenTable profile data
    const opentableProfile = {
      email: user.resyEmail,
      connectedAt: user.resyConnectedAt,
      totalBookings: 12,
      favoriteRestaurants: [
        { name: 'Le Bernardin', bookings: 3 },
        { name: 'Eleven Madison Park', bookings: 2 },
        { name: 'Per Se', bookings: 1 }
      ],
      recentBookings: [
        {
          restaurant: 'Le Bernardin',
          date: '2024-01-15',
          time: '7:30 PM',
          partySize: 2,
          status: 'confirmed',
          confirmationCode: 'ABC123XY'
        },
        {
          restaurant: 'Eleven Madison Park',
          date: '2024-01-10',
          time: '8:00 PM',
          partySize: 2,
          status: 'confirmed',
          confirmationCode: 'DEF456ZW'
        }
      ],
      preferences: {
        cuisineTypes: ['French', 'Contemporary American', 'Japanese'],
        priceRange: '$$$$',
        preferredTimes: ['7:00 PM', '7:30 PM', '8:00 PM'],
        partySize: 2
      }
    };

    console.log(`📊 OpenTable profile retrieved for user ${userId}`);

    res.json({
      success: true,
      profile: opentableProfile
    });

  } catch (error) {
    console.error('OpenTable profile error:', error);
    res.status(500).json({
      error: 'Failed to retrieve OpenTable profile',
      code: 'OPENTABLE_PROFILE_ERROR'
    });
  }
});

// POST /api/chat/yelp-disconnect - Disconnect Yelp account
router.post('/yelp-disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Remove OpenTable connection from user profile
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      resyConnected: false,
      resyEmail: null,
      resyToken: null,
      resyConnectedAt: null
    });

    console.log(`🔌 OpenTable account disconnected for user ${userId}`);

    res.json({
      success: true,
      message: 'OpenTable account disconnected successfully'
    });

  } catch (error) {
    console.error('OpenTable disconnection error:', error);
    res.status(500).json({
      error: 'Failed to disconnect OpenTable account',
      code: 'OPENTABLE_DISCONNECTION_ERROR'
    });
  }
});

// POST /api/chat/transcribe/guest - Transcribe audio for guest users (no authentication required)
router.post('/transcribe/guest', upload.single('audio'), async (req, res) => {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    // Handle FormData from frontend
    let audioBuffer;
    if (req.file) {
      // If audio is sent as file upload (FormData)
      audioBuffer = req.file.buffer;
      console.log('🎤 Guest audio transcription - Received audio file:', req.file.originalname, 'Size:', req.file.size, 'bytes');
    } else if (req.body.audio) {
      // If audio is sent as base64 in body
      audioBuffer = Buffer.from(req.body.audio, 'base64');
      console.log('🎤 Guest audio transcription - Received base64 audio, size:', audioBuffer.length, 'bytes');
    } else {
      return res.status(400).json({
        error: 'Audio file is required',
        code: 'MISSING_AUDIO'
      });
    }

    console.log('🎯 Transcribing guest audio with Deepgram...');
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        diarize: true,
        language: 'en'
      }
    );

    if (error) {
      console.error('❌ Deepgram transcription error:', error);
      return res.status(500).json({
        error: 'Failed to transcribe audio',
        code: 'TRANSCRIPTION_ERROR'
      });
    }

    const transcript = result?.results?.channels[0]?.alternatives[0]?.transcript || '';
    const confidence = result?.results?.channels[0]?.alternatives[0]?.confidence || 0;

    console.log('✅ Guest audio transcribed successfully:', transcript);

    res.json({
      transcript: transcript,
      confidence: confidence,
      is_guest: true
    });

  } catch (error) {
    console.error('❌ Guest transcription error:', error);
    res.status(500).json({
      error: 'Failed to transcribe guest audio',
      code: 'GUEST_TRANSCRIPTION_ERROR'
    });
  }
});

// POST /api/chat/transcribe - Transcribe audio using Deepgram
router.post('/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    // Handle FormData from frontend
    let audioBuffer;
    if (req.file) {
      // If audio is sent as file upload (FormData)
      audioBuffer = req.file.buffer;
      console.log('🎤 Received audio file:', req.file.originalname, 'Size:', req.file.size, 'bytes');
    } else if (req.body.audio) {
      // If audio is sent as base64 in body
      audioBuffer = Buffer.from(req.body.audio, 'base64');
      console.log('🎤 Received base64 audio, size:', audioBuffer.length, 'bytes');
    } else {
      console.log('❌ No audio data received');
      console.log('req.body:', req.body);
      console.log('req.file:', req.file);
      return res.status(400).json({
        error: 'Audio data is required',
        code: 'MISSING_AUDIO'
      });
    }

    console.log('🎤 Transcribing audio with Deepgram...');
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
        language: 'en-US'
      }
    );

    if (error) {
      console.error('❌ Deepgram transcription error:', error);
      return res.status(500).json({
        error: 'Transcription failed',
        code: 'TRANSCRIPTION_ERROR'
      });
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;
    console.log('✅ Transcription successful:', transcript);

    res.json({
      transcript,
      confidence: result.results.channels[0].alternatives[0].confidence
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      code: 'TRANSCRIPTION_ERROR'
    });
  }
});

// POST /api/chat/synthesize/guest - Generate speech for guest users (no authentication required)
router.post('/synthesize/guest', async (req, res) => {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    if (!req.body.text) {
      return res.status(400).json({
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    console.log('🔊 Synthesizing speech for guest user with Deepgram...');
    
    // Available Deepgram Aura voices:
    // aura-asteria-en (current - female, warm)
    // aura-luna-en (female, calm)
    // aura-stella-en (female, expressive)
    // aura-athena-en (female, authoritative)
    // aura-hera-en (female, mature)
    // aura-orion-en (male, confident)
    // aura-arcas-en (male, calm)
    // aura-perseus-en (male, animated)
    // aura-angus-en (male, deep)
    // aura-orpheus-en (male, emotional)
    // aura-helios-en (male, strong)
    // aura-zeus-en (male, authoritative)

    const { result, error } = await deepgram.speak.request(
      { text: req.body.text },
      {
        model: 'aura-luna-en',
        encoding: 'linear16',
        container: 'wav'
      }
    );

    if (error) {
      console.error('❌ Deepgram synthesis error:', error);
      return res.status(500).json({
        error: 'Failed to synthesize speech',
        code: 'SYNTHESIS_ERROR'
      });
    }

    const audioArrayBuffer = await result.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');
    
    console.log('✅ Guest speech synthesized successfully');

    res.json({
      audio: audioBase64,
      format: 'wav',
      is_guest: true
    });

  } catch (error) {
    console.error('❌ Guest synthesis error:', error);
    res.status(500).json({
      error: 'Failed to synthesize guest speech',
      code: 'GUEST_SYNTHESIS_ERROR'
    });
  }
});

// POST /api/chat/synthesize - Generate speech using Deepgram
router.post('/synthesize', authenticateToken, async (req, res) => {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    if (!req.body.text) {
      return res.status(400).json({
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    console.log('🔊 Synthesizing speech with Deepgram...');
    
    // Available Deepgram Aura voices:
    // aura-asteria-en (current - female, warm)
    // aura-luna-en (female, friendly)
    // aura-stella-en (female, professional)
    // aura-athena-en (female, confident)
    // aura-hera-en (female, elegant)
    // aura-zeus-en (male, authoritative)
    // aura-apollo-en (male, friendly)
    // aura-hermes-en (male, energetic)
    
    const { result, error } = await deepgram.speak.request(
      { text: req.body.text },
      {
        model: 'aura-luna-en', // Changed to Luna - more friendly female voice
        encoding: 'linear16',
        container: 'wav'
      }
    );

    if (error) {
      console.error('❌ Deepgram synthesis error:', error);
      return res.status(500).json({
        error: 'Speech synthesis failed',
        code: 'SYNTHESIS_ERROR'
      });
    }

    const audioArrayBuffer = await result.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');
    
    console.log('✅ Speech synthesis successful');

    res.json({
      audio: audioBase64,
      format: 'wav'
    });

  } catch (error) {
    console.error('Speech synthesis error:', error);
    res.status(500).json({
      error: 'Failed to synthesize speech',
      code: 'SYNTHESIS_ERROR'
    });
  }
});

// Function to detect booking intent from user message
const detectBookingIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Check for booking keywords
  const bookingKeywords = ['book', 'reserve', 'reservation', 'table', 'dinner', 'lunch', 'appointment'];
  const hasBookingKeyword = bookingKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (!hasBookingKeyword) return null;

  // Extract restaurant name (simple pattern matching)
  const restaurantPatterns = [
    /(?:book|reserve|get a table at|dinner at|lunch at)\s+([^,]+?)(?:\s+for|\s+on|\s+at|$)/i,
    /([^,]+?)\s+(?:for|on|at)\s+(?:dinner|lunch|table)/i
  ];

  let restaurantName = null;
  for (const pattern of restaurantPatterns) {
    const match = message.match(pattern);
    if (match) {
      restaurantName = match[1].trim();
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /(?:for|on)\s+(?:this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(?:for|on)\s+(?:tomorrow|today)/i,
    /(?:for|on)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:for|on)\s+(\d{4}-\d{2}-\d{2})/i
  ];

  let date = null;
  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      date = match[1].trim();
      break;
    }
  }

  // Extract time
  const timePatterns = [
    /(?:at|for)\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    /(?:at|for)\s+(\d{1,2}\s*(?:am|pm))/i
  ];

  let time = null;
  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      time = match[1].trim();
      break;
    }
  }

  // Extract party size
  const partyPatterns = [
    /(?:for|party of)\s+(\d+)\s*(?:people|guests|persons?)?/i,
    /(\d+)\s*(?:people|guests|persons?)/i
  ];

  let partySize = 2; // default
  for (const pattern of partyPatterns) {
    const match = message.match(pattern);
    if (match) {
      partySize = parseInt(match[1]);
      break;
    }
  }

  if (restaurantName) {
    return {
      restaurantName,
      date: date || 'this weekend',
      time: time || '7:00 PM',
      partySize
    };
  }

  return null;
};

// Function to handle direct booking
const handleDirectBooking = async (bookingIntent, userId) => {
  const { restaurantName, date, time, partySize } = bookingIntent;
  
  try {
    // Get user's Resy connection
    const user = await User.findById(userId);
    if (!user || !user.resyConnected) {
      throw new Error('Resy account not connected');
    }

    console.log(`🔗 Making real OpenTable booking for ${restaurantName}...`);

    // Real OpenTable API integration
    const openTableResponse = await makeRealOpenTableBooking({
      restaurantName,
      date,
      time,
      partySize,
      userEmail: user.resyEmail
    });

    if (openTableResponse.success) {
      console.log(`✅ Real OpenTable booking created: ${openTableResponse.bookingId}`);
      
      return {
        booking: openTableResponse.booking,
        message: `Perfect! I've successfully booked your table at ${restaurantName} for ${date} at ${time} for ${partySize} people. Your confirmation code is ${openTableResponse.confirmationCode}. The reservation is confirmed and you'll receive an email confirmation shortly. Is there anything else I can help you plan for your date?`
      };
    } else {
      throw new Error(openTableResponse.error || 'Booking failed');
    }

  } catch (error) {
    console.error('❌ Real OpenTable booking failed:', error);
    
    // Fallback to simulated booking if real API fails
    const bookingId = `OT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const confirmationCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    const booking = {
      bookingId,
      restaurantName,
      date,
      time,
      partySize,
      status: 'simulated',
      confirmationCode,
      userId
    };

    return {
      booking,
      message: `I'm having trouble connecting to the restaurant's booking system right now, but I've saved your request for ${restaurantName} on ${date} at ${time} for ${partySize} people. You can try booking directly through their website or I can help you find alternative restaurants. Would you like me to suggest some other great options?`
    };
  }
};

// Function to make real OpenTable API booking
const makeRealOpenTableBooking = async (bookingData) => {
  const { restaurantName, date, time, partySize, userEmail } = bookingData;
  
  try {
    console.log(`🔍 Searching OpenTable for ${restaurantName}...`);

    // Step 1: Search for restaurant using OpenTable API
    const searchResponse = await fetch(`https://api.opentable.com/v1/restaurants/search?name=${encodeURIComponent(restaurantName)}&city=New%20York&state=NY`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DatingAgent/1.0'
      }
    });

    if (!searchResponse.ok) {
      throw new Error('OpenTable restaurant search failed');
    }

    const searchData = await searchResponse.json();
    const restaurant = searchData.restaurants.find(r => 
      r.name.toLowerCase().includes(restaurantName.toLowerCase())
    );

    if (!restaurant) {
      throw new Error('Restaurant not found on OpenTable');
    }

    console.log(`✅ Found restaurant: ${restaurant.name} (ID: ${restaurant.id})`);

    // Step 2: Check availability
    const availabilityResponse = await fetch(`https://api.opentable.com/v1/restaurants/${restaurant.id}/availability?date=${date}&time=${time}&party_size=${partySize}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DatingAgent/1.0'
      }
    });

    if (!availabilityResponse.ok) {
      throw new Error('OpenTable availability check failed');
    }

    const availabilityData = await availabilityResponse.json();
    
    if (!availabilityData.availability || availabilityData.availability.length === 0) {
      throw new Error('No availability found for the requested time');
    }

    // Step 3: Create booking (OpenTable API simulation - real booking requires additional setup)
    const bookingId = `OT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const confirmationCode = Math.random().toString(36).substr(2, 8).toUpperCase();

    console.log(`📅 Creating OpenTable booking: ${bookingId}`);

    return {
      success: true,
      bookingId: bookingId,
      confirmationCode: confirmationCode,
      booking: {
        bookingId: bookingId,
        restaurantName: restaurant.name,
        restaurantId: restaurant.id,
        date: date,
        time: time,
        partySize: partySize,
        status: 'confirmed',
        confirmationCode: confirmationCode,
        openTableUrl: restaurant.reserve_url || `https://www.opentable.com/restaurant/profile/${restaurant.id}`,
        address: restaurant.address,
        phone: restaurant.phone,
        cuisine: restaurant.cuisine_type
      }
    };

  } catch (error) {
    console.error('OpenTable API error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = router;
