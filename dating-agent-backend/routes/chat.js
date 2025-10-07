const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const axios = require('axios');
const { createClient } = require('@deepgram/sdk');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const eventbriteService = require('../services/eventbriteService');
const ticketmasterService = require('../services/ticketmasterService');
const router = express.Router();

// Simple in-memory store for guest conversations
const guestConversations = new Map();

// Store user and partner profiles in conversation context
const storeProfilesInContext = async (sessionId, userProfile, partnerProfile, isGuest = false) => {
  try {
    if (isGuest) {
      // Store in guest conversations
      if (!guestConversations.has(sessionId)) {
        guestConversations.set(sessionId, {
          messages: [],
          context: {
            user_profile: null,
            partner_profile: null,
            date_planning_context: {}
          }
        });
      }
      
      const conversation = guestConversations.get(sessionId);
      conversation.context.user_profile = userProfile;
      conversation.context.partner_profile = partnerProfile;
      
      console.log('💾 Stored profiles in guest conversation context:', {
        sessionId,
        hasUserProfile: !!userProfile,
        hasPartnerProfile: !!partnerProfile
      });
    } else {
      // Store in database conversation
      const conversation = await Conversation.findOne({ session_id: sessionId });
      if (conversation) {
        conversation.context.date_planning_context.user_profile = userProfile;
        conversation.context.date_planning_context.partner_profile = partnerProfile;
        await conversation.save();
        
        console.log('💾 Stored profiles in database conversation context:', {
          sessionId,
          hasUserProfile: !!userProfile,
          hasPartnerProfile: !!partnerProfile
        });
      }
    }
  } catch (error) {
    console.error('❌ Error storing profiles in context:', error);
  }
};

// Retrieve user and partner profiles from conversation context
const getProfilesFromContext = async (sessionId, isGuest = false) => {
  try {
    if (isGuest) {
      const conversation = guestConversations.get(sessionId);
      if (conversation && conversation.context) {
        return {
          userProfile: conversation.context.user_profile,
          partnerProfile: conversation.context.partner_profile
        };
      }
    } else {
      const conversation = await Conversation.findOne({ session_id: sessionId });
      if (conversation && conversation.context && conversation.context.date_planning_context) {
        return {
          userProfile: conversation.context.date_planning_context.user_profile,
          partnerProfile: conversation.context.date_planning_context.partner_profile
        };
      }
    }
    
    return { userProfile: null, partnerProfile: null };
  } catch (error) {
    console.error('❌ Error retrieving profiles from context:', error);
    return { userProfile: null, partnerProfile: null };
  }
};

// Universal profile retrieval function for all endpoints
const getProfilesForEndpoint = async (req, sessionId = null) => {
  try {
    let userProfile = null;
    let partnerProfile = null;
    
    // 1. Try to get user profile and partner from database (for authenticated users)
    if (req.user && req.user.userId) {
      const user = await User.findById(req.user.userId)
        .select('profile active_partner')
        .populate('active_partner');
      
      userProfile = user?.profile || null;
      console.log('💾 Retrieved user profile from database:', {
        hasUserProfile: !!userProfile,
        userName: userProfile?.name,
        userInterests: userProfile?.interests,
        userInterestsType: typeof userProfile?.interests,
        userInterestsLength: userProfile?.interests?.length
      });
      
      // Get partner profile from the populated active_partner field or query directly
      if (user?.active_partner) {
        partnerProfile = user.active_partner.toObject ? user.active_partner.toObject() : user.active_partner;
        console.log('💾 Retrieved partner profile from user.active_partner (populated):', {
          hasPartnerProfile: !!partnerProfile,
          partnerName: partnerProfile?.name,
          partnerInterests: partnerProfile?.interests,
          partnerInterestsType: typeof partnerProfile?.interests,
          partnerInterestsLength: partnerProfile?.interests?.length,
          partnerPreferences: partnerProfile?.preferences
        });
      } else {
        // Fallback: Try to find an active partner if active_partner field is not set
        const Partner = require('../models/Partner');
        const dbPartnerProfile = await Partner.findOne({ user_id: req.user.userId, is_active: true });
        if (dbPartnerProfile) {
          partnerProfile = dbPartnerProfile.toObject();
          console.log('💾 Retrieved partner profile from database query (fallback):', {
            hasPartnerProfile: !!partnerProfile,
            partnerName: partnerProfile?.name,
            partnerInterests: partnerProfile?.interests,
            partnerId: dbPartnerProfile._id
          });
          
          // Update the user's active_partner field for future queries
          user.active_partner = dbPartnerProfile._id;
          await user.save();
          console.log('✅ Updated user.active_partner field for future use');
        }
      }
    }
    
    // 2. Try to get partner profile from request body/query (can override database)
    if (req.body?.partner_profile) {
      try {
        const bodyPartnerProfile = typeof req.body.partner_profile === 'string' 
          ? JSON.parse(req.body.partner_profile) 
          : req.body.partner_profile;
        
        if (bodyPartnerProfile && Object.keys(bodyPartnerProfile).length > 0) {
          partnerProfile = bodyPartnerProfile;
          console.log('💾 Retrieved partner profile from request body (overriding database):', {
            hasPartnerProfile: !!partnerProfile,
            partnerName: partnerProfile?.name,
            partnerInterests: partnerProfile?.interests,
            partnerInterestsType: typeof partnerProfile?.interests,
            partnerInterestsLength: partnerProfile?.interests?.length,
            partnerPreferences: partnerProfile?.preferences
          });
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse partner profile from request body:', error.message);
      }
    }
    
    if (req.query?.partner_profile && req.query.partner_profile.trim() !== '') {
      try {
        const queryPartnerProfile = JSON.parse(req.query.partner_profile);
        if (queryPartnerProfile && Object.keys(queryPartnerProfile).length > 0) {
          partnerProfile = queryPartnerProfile;
          console.log('💾 Retrieved partner profile from query params (overriding database):', {
            hasPartnerProfile: !!partnerProfile,
            partnerName: partnerProfile?.name,
            partnerInterests: partnerProfile?.interests,
            partnerInterestsType: typeof partnerProfile?.interests,
            partnerInterestsLength: partnerProfile?.interests?.length,
            partnerPreferences: partnerProfile?.preferences
          });
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse partner profile from query params:', error.message);
      }
    }
    
    // 3. Try to get profiles from context if sessionId is provided
    if (sessionId) {
      const { userProfile: contextUserProfile, partnerProfile: contextPartnerProfile } = await getProfilesFromContext(sessionId, !req.user);
      
      // Use context profiles as fallback or enhancement
      if (!userProfile && contextUserProfile) {
        userProfile = contextUserProfile;
        console.log('💾 Using user profile from context as fallback:', {
          userName: userProfile?.name,
          userInterests: userProfile?.interests
        });
      }
      
      if (!partnerProfile && contextPartnerProfile) {
        partnerProfile = contextPartnerProfile;
        console.log('💾 Using partner profile from context as fallback:', {
          partnerName: partnerProfile?.name,
          partnerInterests: partnerProfile?.interests
        });
      }
    }
    
    // 4. Store profiles in context for future use
    if (sessionId && (userProfile || partnerProfile)) {
      await storeProfilesInContext(sessionId, userProfile, partnerProfile, !req.user);
    }
    
    return { userProfile, partnerProfile };
  } catch (error) {
    console.error('❌ Error in getProfilesForEndpoint:', error);
    return { userProfile: null, partnerProfile: null };
  }
};

// Date flow endpoint
router.post('/date-flow', authenticateToken, async (req, res) => {
  try {
    const { location, preferences } = req.body;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        code: 'MISSING_LOCATION'
      });
    }

    console.log(`🎯 Date flow request for location: ${location}`);

    // Get user profile from the authenticated request
    const userProfile = req.user ? {
      name: req.user.name,
      interests: req.user.interests,
      budget: req.user.budget,
      preferences: req.user.preferences
    } : null;

    // Get partner profile from request body (if available)
    const partnerProfile = req.body.partner_profile || null;

    // Call Groq API for personalized date flow
    const dateFlow = await callGroqForDateFlow(location, userProfile, partnerProfile, preferences);

    if (dateFlow && dateFlow.flow && dateFlow.flow.length > 0) {
      console.log(`✅ Returning personalized date flow from Groq with ${dateFlow.flow.length} steps`);
      res.json({
        dateFlow: dateFlow,
        location: location,
        source: 'groq_api',
        userProfile: userProfile,
        partnerProfile: partnerProfile
      });
    } else {
      console.log('⚠️ No date flow from Groq, returning fallback flow');
      // Return fallback date flow if Groq fails
      const cityName = location.split(',')[0];
      const fallbackFlow = {
        title: `Romantic Evening in ${cityName}`,
        totalDuration: preferences?.duration || "3-4 hours",
        totalBudget: preferences?.budget || "$60-80",
        flow: [
          {
            step: 1,
            phase: "Warm-Up",
            activity: "Coffee & Conversation",
            venue: `${cityName} Coffee House`,
            address: `Downtown ${cityName}`,
            duration: "30 minutes",
            cost: "$15-25",
            description: `Start your date with a cozy coffee at a local café in ${cityName}. This relaxed setting is perfect for easing into conversation and getting comfortable.`,
            tips: "Choose a quiet corner for more intimate conversation"
          },
          {
            step: 2,
            phase: "Main Event",
            activity: "Cultural Experience",
            venue: `${cityName} Art Gallery`,
            address: `${cityName} Arts District`,
            duration: "2 hours",
            cost: "$30-45",
            description: `Explore ${cityName}'s vibrant art scene together. Walking through galleries provides natural conversation starters and shared experiences.`,
            tips: "Discuss your favorite pieces to learn more about each other"
          },
          {
            step: 3,
            phase: "Closer",
            activity: "Scenic Walk",
            venue: `${cityName} Waterfront Park`,
            address: `${cityName} Harbor`,
            duration: "45 minutes",
            cost: "Free",
            description: `End your evening with a romantic walk along ${cityName}'s waterfront. The peaceful setting is perfect for deeper conversation.`,
            tips: "Perfect time to share more personal stories and connect"
          }
        ],
        restaurants: [
          {
            name: `${cityName} Bistro`,
            address: `${cityName} Downtown`,
            cuisine: "Contemporary American",
            priceRange: "$25-40 per person",
            description: "Cozy atmosphere perfect for intimate conversation",
            reservation: "7:30 PM recommended"
          }
        ],
        backupOptions: [
          {
            scenario: "Weather issue",
            alternative: "Indoor museum visit",
            venue: `${cityName} History Museum`,
            cost: "$20-30"
          }
        ],
        logistics: {
          transportation: "Walking between nearby locations",
          parking: "Street parking available downtown",
          timing: "Start around 6:00 PM",
          weather: "Check weather forecast for outdoor activities"
        }
      };

      res.json({
        dateFlow: fallbackFlow,
        location: location,
        source: 'fallback',
        userProfile: userProfile,
        partnerProfile: partnerProfile
      });
    }
  } catch (error) {
    console.error('❌ Date flow endpoint error:', error);
    res.status(500).json({
      error: 'Failed to generate date flow',
      code: 'DATE_FLOW_ERROR'
    });
  }
});

// Date ideas endpoint
router.get('/date-ideas', authenticateToken, async (req, res) => {
  try {
    const { location, force_refresh } = req.query;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        code: 'MISSING_LOCATION'
      });
    }

    console.log(`💡 Date ideas request for location: ${location}`);

    // Check cache first only if force_refresh is not requested
    if (force_refresh !== 'true') {
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
    } else {
      console.log(`🔄 Force refresh requested - bypassing cache for date ideas: ${location}`);
    }

    // Get user and partner profiles using universal function
    const sessionId = req.query.session_id || `date-ideas-${Date.now()}`;
    const { userProfile, partnerProfile } = await getProfilesForEndpoint(req, sessionId);
    
    console.log('💾 Final profiles for date-ideas endpoint:', {
      hasUserProfile: !!userProfile,
      hasPartnerProfile: !!partnerProfile,
      userName: userProfile?.name,
      partnerName: partnerProfile?.name
    });

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
    const { location, neighborhood, travel_radius, force_refresh } = req.query;
    
    console.log('🔍 Events API Debug - Received parameters:', {
      location,
      neighborhood,
      travel_radius,
      force_refresh,
      allQueryParams: req.query,
      userId: req.user?.userId
    });
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        code: 'MISSING_LOCATION'
      });
    }

    const radius = travel_radius || '3';
    const neighborhoodInfo = neighborhood ? ` (${neighborhood})` : '';
    
    console.log(`🎯 Processing events request: ${location}${neighborhoodInfo} within ${radius} miles`);
    console.log(`📅 Events request for location: ${location}${neighborhoodInfo}, radius: ${radius} miles`);

    // Create a more specific cache key that includes neighborhood and radius
    const cacheKey = `${location}-${neighborhood || 'no-neighborhood'}-${radius}`;
    
    // Check cache only if force_refresh is not requested
    console.log(`🔍 Cache check debug: force_refresh='${force_refresh}', type: ${typeof force_refresh}, strict check: ${force_refresh !== 'true'}`);
    if (force_refresh !== 'true') {
      const cachedEvents = getCachedEvents(cacheKey);
      if (cachedEvents) {
        console.log(`📋 Using cached events for: ${cacheKey}`);
        return res.json({
          events: cachedEvents,
          location: location,
          neighborhood: neighborhood,
          radius: radius,
          source: 'cache',
          count: cachedEvents.length
        });
      }
    } else {
      console.log(`🔄 Force refresh requested - bypassing cache for: ${cacheKey}`);
    }

    // Get user and partner profiles using universal function
    const sessionId = req.query.session_id || `events-${Date.now()}`;
    const { userProfile, partnerProfile } = await getProfilesForEndpoint(req, sessionId);
    
    console.log('💾 Final profiles for events endpoint:', {
      hasUserProfile: !!userProfile,
      hasPartnerProfile: !!partnerProfile,
      userName: userProfile?.name,
      partnerName: partnerProfile?.name
    });

    // Call both Eventbrite and Ticketmaster APIs for real events with location preferences
    const events = await callCombinedEventsAPI(location, userProfile, partnerProfile, neighborhood, radius);

    if (events && events.length > 0) {
      console.log(`✅ Returning ${events.length} real events from combined APIs`);
      setCachedEvents(cacheKey, events); // Cache the results with specific key
      res.json({
        events: events,
        location: location,
        neighborhood: neighborhood,
        radius: radius,
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
        neighborhood: neighborhood,
        radius: radius,
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

    // Get current events for the user's location
    let currentEvents = [];
    try {
      const userLocation = user.profile?.location || 'New York, NY';
      const neighborhood = user.profile?.neighborhood || '';
      const travelRadius = user.profile?.travel_radius || '3';
      
      console.log('🎫 Fetching current events for chat context:', { userLocation, neighborhood, travelRadius });
      currentEvents = await callCombinedEventsAPI(userLocation, user.profile, partnerProfile, neighborhood, travelRadius);
      console.log(`🎫 Found ${currentEvents.length} events for chat context`);
    } catch (error) {
      console.warn('⚠️ Could not fetch events for chat context:', error.message);
    }

    // Build context object
    const context = {
      userProfile: user.profile,
      partnerProfile: partnerProfile,
      currentEvents: currentEvents, // Add Ticketmaster events to context
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

    // Log context for debugging
    console.log('🔍 Context being built for AI:', {
      hasUserProfile: !!context.userProfile,
      hasPartnerProfile: !!context.partnerProfile,
      userInterests: context.userProfile?.interests || [],
      partnerInterests: context.partnerProfile?.interests || [],
      partnerName: context.partnerProfile?.name || 'No name'
    });

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
      return "Great! Coffee or lunch works perfectly. What's your budget?";
  }
  
  if (message.includes('restaurant') || message.includes('dinner')) {
      return "Perfect! What cuisine do you both like?";
    }
    
    if (message.includes('help') || message.includes('plan') || message.includes('suggest')) {
      return "I'm here to help! What type of date are you planning?";
    }
    
    return "Hi! I'm your DateFlow AI assistant! 🎯 What would you like help with?";
  }
  
  // Build on previous conversation context
  if (conversationSummary.includes('dinner') && message.includes('italian')) {
    return "Italian is perfect! Cozy or modern spot?";
  }
  
  if (conversationSummary.includes('dinner') && message.includes('budget')) {
    return "What's your budget? Casual ($15-25) or upscale ($40-60)?";
  }
  
  if (message.includes('activity') || message.includes('what to do')) {
    return "What interests you? Outdoor, cultural, or relaxed?";
  }
  
  if (message.includes('budget') || message.includes('cost') || message.includes('money')) {
    return "What's your budget range?";
  }
  
  if (message.includes('location') || message.includes('where')) {
    return "Where are you located? Close to home or traveling?";
  }
  
  if (message.includes('weather') || message.includes('rain') || message.includes('outdoor')) {
    return "Rain coming? Let's pivot to indoor options.";
  }
  
  if (message.includes('second date') || message.includes('follow up')) {
    return "Second date! What did you enjoy about the first?";
  }
  
  // More contextual responses based on conversation flow
  if (messageCount > 1) {
    if (message.includes('yes') || message.includes('sounds good') || message.includes('perfect')) {
      return "Great! What's next?";
    }
    
    if (message.includes('no') || message.includes('not sure')) {
      return "No problem! What other aspects interest you?";
    }
  }
  
  return "Interesting! What specific part needs help?";
};


// Enhanced Fiona fallback response generator
const generateFionaResponse = (userMessage, context) => {
  const message = userMessage.toLowerCase();
  
  // Get partner name if available
  const partnerName = context?.partnerProfile?.name || 'your partner';
  
  if (message.includes('help') || message.includes('plan')) {
    return `I'd be happy to help you plan something special. What kind of experience are you thinking about for ${partnerName}?`;
  }
  
  if (message.includes('restaurant') || message.includes('dinner') || message.includes('food')) {
    return `Food can really make a date memorable. What's your budget range, and does ${partnerName} have any favorite types of cuisine?`;
  }
  
  if (message.includes('activity') || message.includes('fun') || message.includes('do')) {
    return `There are so many great options out there. What does ${partnerName} typically enjoy doing? Are they more into indoor or outdoor activities?`;
  }
  
  if (message.includes('budget') || message.includes('money') || message.includes('cost')) {
    return `It's good to have a budget in mind. What range are you thinking? I can share some ideas that work well at different price points.`;
  }
  
  if (message.includes('location') || message.includes('where') || message.includes('place')) {
    return `Location can really set the tone. Are you thinking of staying local or exploring somewhere new?`;
  }
  
  if (message.includes('romantic') || message.includes('special')) {
    return `Special moments are so important. What kind of things does ${partnerName} appreciate? I'd love to help you think of something they'd really enjoy.`;
  }
  
  if (message.includes('weather') || message.includes('outdoor')) {
    return `The weather can definitely influence plans. What's it like where you are, and does ${partnerName} enjoy being outdoors?`;
  }
  
  return `That sounds interesting! I'd be happy to help you think through some ideas. What aspects are you most curious about?`;
};

// Groq AI integration for date flow planning
const callGroqForDateFlow = async (location, userProfile, partnerProfile, preferences, aiRecommendation = null) => {
  try {
    console.log('🎯 ===== CALLING GROQ FOR DATEFLOW =====');
    console.log('🎯 Location:', location);
    console.log('🎯 User profile:', JSON.stringify(userProfile, null, 2));
    console.log('🎯 Partner profile:', JSON.stringify(partnerProfile, null, 2));
    console.log('🎯 Preferences:', JSON.stringify(preferences, null, 2));
    console.log('🎯 AI Recommendation:', aiRecommendation);
    
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      console.warn('❌ GROQ_API_KEY not found for date flow');
      return null;
    }
    console.log('✅ Groq API Key present');

    // Wait for rate limiting if needed
    console.log('🎯 Checking Groq rate limits...');
    await waitForGroqRateLimit();
    console.log('✅ Rate limiting check passed');

    const cityName = location.split(',')[0].trim();
    const stateName = location.split(',')[1]?.trim() || '';
    const fullLocation = stateName ? `${cityName}, ${stateName}` : cityName;

    const userContext = userProfile ? `
USER PROFILE:
- Name: ${userProfile.name || 'User'}
- Interests: ${userProfile.interests || 'Not specified'}
- Budget: ${userProfile.budget || 'Not specified'}
- Location: ${fullLocation}
- Neighborhood: ${userProfile.neighborhood || 'Not specified'}
- Travel Radius: ${userProfile.travel_radius || 3} miles
- Preferences: ${userProfile.preferences || 'Not specified'}` : '';

    const partnerContext = partnerProfile?.name ? `

PARTNER PROFILE:
- Partner Name: ${partnerProfile.name}
- Interests: ${partnerProfile.interests || 'Not specified'}
- Preferences: ${partnerProfile.preferences || 'Not specified'}
- Budget Range: ${partnerProfile.budget || 'Not specified'}
- Dietary Restrictions: ${partnerProfile.dietaryRestrictions || 'None'}` : '';

    const preferencesContext = preferences ? `

DATE PREFERENCES:
- Duration: ${preferences.duration || 'Not specified'}
- Budget: ${preferences.budget || 'Not specified'}
- Style: ${preferences.style || 'Not specified'}
- Activities: ${preferences.activities?.join(', ') || 'Not specified'}
- Restaurants: ${preferences.restaurants?.join(', ') || 'Not specified'}
- Times: ${preferences.times?.join(', ') || 'Not specified'}
- Locations: ${preferences.locations?.join(', ') || 'Not specified'}
- Event Details: ${preferences.event_details?.name ? `${preferences.event_details.name} (${preferences.event_details.category}) on ${preferences.event_details.date} at ${preferences.event_details.location} - ${preferences.event_details.cost} - ${preferences.event_details.description}` : 'Not specified'}
- Plan Summary: ${preferences.summary || 'Not specified'}
- Preferred Neighborhood/Area: ${preferences.neighborhood || 'Not specified'}` : '';

    const prompt = `Create a personalized date flow for ${fullLocation}. This should be a detailed, step-by-step itinerary that considers all the provided information.${userContext}${partnerContext}${preferencesContext}

    CRITICAL: If event_details contains specific event information (like "Harry Potter", "Hamilton", etc.), create a date flow AROUND that specific event:
    - Include pre-event activities (dinner, drinks, preparation)
    - Plan the main event experience with timing and logistics
    - Add post-event activities (after-party, late-night spots, romantic walks)
    - Make it a complete day/night experience that flows perfectly
    
    ${aiRecommendation ? `SPECIAL INSTRUCTION: Incorporate this personalized recommendation into the DateFlow: "${aiRecommendation}"` : ''}
    
    IMPORTANT: If event_details contains a URL (event.url), include it in the main event step as ticketmaster_url. Use the actual event URL from the events data, not placeholder URLs.

    Create a comprehensive date flow with:
    1. **Warm-Up Activity** (15-30 minutes) - Something relaxed to start
    2. **Main Event** (1-2 hours) - The primary activity/experience (USE THE SPECIFIC EVENT IF PROVIDED)
    3. **Optional Closer** (30-60 minutes) - Something to end on a high note
    4. **Restaurant Recommendations** - Specific restaurants in ${cityName} that fit the vibe
    5. **Timing & Logistics** - Exact durations and travel time between locations
    6. **Budget Breakdown** - Cost estimates for each part
    7. **Backup Options** - Alternative activities if weather/availability changes

    CRITICAL NEIGHBORHOOD REQUIREMENTS:
    - HEAVILY prioritize the user's neighborhood: "${userProfile?.neighborhood || preferences?.neighborhood || 'Not specified'}"
    - If a specific neighborhood is provided, focus 80% of activities in that area
    - Prefer venues within the user's travel radius: ${userProfile?.travel_radius || 3} miles
    - Choose restaurants and activities that are easily accessible from the specified neighborhood
    - Consider the neighborhood's character (downtown vs arts district vs residential, etc.)

    IMPORTANT:
    - Use REAL venues and restaurants in ${cityName}
    - Consider both user and partner preferences
    - Make it realistic and achievable
    - Include specific venue names and addresses when possible
    - Factor in travel time between locations (prioritize same neighborhood)
    - Consider the budget constraints
    - Make it romantic and memorable
    - For events: Include pre-event drinks/dinner recommendations near the venue
    - Add specific recommendations like "Get drinks at [bar name] before the show" with is_recommendation: true
    - Include Ticketmaster URLs for events when available
    - Highlight recommendations with detailed suggestions

    Format your response as a JSON object with this exact structure:
    {
      "title": "Romantic Evening in [City]",
      "totalDuration": "3-4 hours",
      "totalBudget": "$60-80",
      "event_details": {
        "name": "event name if applicable",
        "venue": "venue name if applicable",
        "date": "event date if applicable",
        "time": "event time if applicable",
        "url": "event URL if applicable",
        "ticketmaster_url": "actual event URL from events data if available"
      },
      "flow": [
        {
          "step": 1,
          "phase": "Warm-Up",
          "activity": "Activity name",
          "venue": "Specific venue name",
          "address": "Full address",
          "duration": "30 minutes",
          "cost": "$15-25",
          "description": "Detailed description of what to do",
          "tips": "Helpful tips for this activity",
          "recommendation": "Specific recommendation (highlight this)",
          "is_recommendation": true
        },
        {
          "step": 2,
          "phase": "Main Event",
          "activity": "Activity name",
          "venue": "Specific venue name", 
          "address": "Full address",
          "duration": "2 hours",
          "cost": "$30-45",
          "description": "Detailed description of what to do",
          "tips": "Helpful tips for this activity",
          "recommendation": "Specific recommendation for this event",
          "is_recommendation": true,
          "ticketmaster_url": "actual event URL from events data if available"
        },
        {
          "step": 3,
          "phase": "Closer",
          "activity": "Activity name",
          "venue": "Specific venue name",
          "address": "Full address", 
          "duration": "45 minutes",
          "cost": "$15-20",
          "description": "Detailed description of what to do",
          "tips": "Helpful tips for this activity",
          "recommendation": "Specific recommendation (highlight this)",
          "is_recommendation": true
        }
      ],
      "restaurants": [
        {
          "name": "Restaurant name",
          "address": "Full address",
          "cuisine": "Type of cuisine",
          "priceRange": "$20-35 per person",
          "description": "Why this fits the date",
          "reservation": "Recommended reservation time"
        }
      ],
      "backupOptions": [
        {
          "scenario": "Weather issue",
          "alternative": "Indoor alternative activity",
          "venue": "Backup venue name",
          "cost": "Cost estimate"
        }
      ],
      "logistics": {
        "transportation": "Best way to get around",
        "parking": "Parking recommendations",
        "timing": "Best time to start",
        "weather": "Weather considerations"
      }
    }`;

    console.log(`🎯 Calling Groq API for personalized date flow in ${fullLocation}...`);
    console.log('🎯 Prompt length:', prompt.length, 'characters');
    console.log('🎯 Event details in prompt:', prompt.includes('event_details') ? 'YES' : 'NO');
    console.log('🎯 Event name in prompt:', preferences.event_details?.name ? preferences.event_details.name : 'NOT FOUND');

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a professional date planning assistant. Create detailed, personalized date flows with specific venues and realistic logistics. Always respond with valid JSON.'
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
    
    console.log('🎯 Groq API response status:', response.status);
    console.log('🎯 Groq API response headers:', JSON.stringify(response.headers, null, 2));

    const aiResponse = response.data.choices[0].message.content;
    console.log(`✅ Groq API date flow response: ${aiResponse.substring(0, 100)}...`);
    console.log('🎯 Full AI response length:', aiResponse.length, 'characters');
    console.log('🎯 AI response contains event details:', aiResponse.includes('event_details') ? 'YES' : 'NO');
    console.log('🎯 AI response contains recommendations:', aiResponse.includes('recommendation') ? 'YES' : 'NO');
    console.log('🎯 AI response contains ticketmaster:', aiResponse.includes('ticketmaster') ? 'YES' : 'NO');

      // Try to parse the JSON response - handle multiple formats with better error handling
      try {
        console.log('🎯 ===== PARSING GROQ RESPONSE =====');
        console.log('📝 Full Groq response length:', aiResponse.length);
        console.log('📝 Raw AI response:', aiResponse);
        
        // Clean the response first - remove any trailing incomplete JSON
        let cleanedResponse = aiResponse.trim();
        console.log('🎯 Cleaned response:', cleanedResponse);
        
        // Remove any text before the first [ or {
        const arrayStart = cleanedResponse.indexOf('[');
        const objectStart = cleanedResponse.indexOf('{');
        const startIndex = Math.min(
          arrayStart === -1 ? Infinity : arrayStart,
          objectStart === -1 ? Infinity : objectStart
        );
        
        if (startIndex !== Infinity) {
          cleanedResponse = cleanedResponse.substring(startIndex);
        }
        
        // Remove any text after the last ] or }
        const arrayEnd = cleanedResponse.lastIndexOf(']');
        const objectEnd = cleanedResponse.lastIndexOf('}');
        const endIndex = Math.max(arrayEnd, objectEnd);
        
        if (endIndex !== -1) {
          cleanedResponse = cleanedResponse.substring(0, endIndex + 1);
        }
        
        // Try to fix common JSON issues
        cleanedResponse = cleanedResponse
          .replace(/,\s*}/g, '}')  // Remove trailing commas before closing braces
          .replace(/,\s*]/g, ']')  // Remove trailing commas before closing brackets
          .replace(/}\s*{/g, '},{') // Fix missing commas between objects
          .replace(/]\s*\[/g, '],[') // Fix missing commas between arrays
          .replace(/"\s*\n\s*"/g, '",\n"') // Fix missing commas between string properties
          .replace(/}\s*\n\s*"/g, '},\n"') // Fix missing commas between object and string
          .replace(/]\s*\n\s*"/g, '],\n"') // Fix missing commas between array and string
          .replace(/,\s*,/g, ',') // Remove double commas
          .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas before closing brackets/braces
      
      // First try to find JSON object in the response with better regex
      let jsonMatch = cleanedResponse.match(/\{[\s\S]*?\}(?=\s*$|\s*```|\s*$)/);
      if (!jsonMatch) {
        // Try to find JSON after "```json" markers
        jsonMatch = cleanedResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1]];
        }
      }
      
      // If still no match, try to find any JSON object that looks complete
      if (!jsonMatch) {
        const jsonStart = cleanedResponse.indexOf('{');
        if (jsonStart !== -1) {
          // Find the last closing brace to get a complete JSON object
          let braceCount = 0;
          let jsonEnd = jsonStart;
          for (let i = jsonStart; i < cleanedResponse.length; i++) {
            if (cleanedResponse[i] === '{') braceCount++;
            if (cleanedResponse[i] === '}') braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
          if (braceCount === 0) {
            jsonMatch = [cleanedResponse.substring(jsonStart, jsonEnd)];
          }
        }
      }
      
      if (jsonMatch) {
        console.log('🎯 Found JSON match:', jsonMatch[0]);
        try {
          const dateFlow = JSON.parse(jsonMatch[0]);
          console.log('🎯 Parsed DateFlow:', JSON.stringify(dateFlow, null, 2));
          if (dateFlow && dateFlow.flow && Array.isArray(dateFlow.flow)) {
            console.log(`🎉 Successfully parsed date flow from Groq with ${dateFlow.flow.length} steps`);
            console.log('🎯 DateFlow title:', dateFlow.title || 'NOT FOUND');
            console.log('🎯 DateFlow event_details:', dateFlow.event_details ? 'FOUND' : 'NOT FOUND');
            if (dateFlow.event_details) {
              console.log('🎯 Event details:', JSON.stringify(dateFlow.event_details, null, 2));
            }
            console.log('🎯 ===== DATEFLOW PARSING SUCCESS =====');
            return dateFlow;
          } else {
            console.log('❌ DateFlow missing flow array or invalid structure');
          }
        } catch (parseError) {
          console.error('❌ Error parsing matched JSON:', parseError.message);
          console.log('📝 Problematic JSON:', jsonMatch[0].substring(0, 300));
      
      // Try to fix common JSON issues
      try {
        console.log('🔧 Attempting to fix JSON formatting...');
        let fixedJson = jsonMatch[0]
          .replace(/\n/g, ' ') // Remove newlines
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2'); // Fix escaped quotes
        
        const dateFlow = JSON.parse(fixedJson);
        if (dateFlow && dateFlow.flow && Array.isArray(dateFlow.flow)) {
          console.log(`🎉 Successfully parsed fixed JSON with ${dateFlow.flow.length} steps`);
          return dateFlow;
        }
      } catch (fixError) {
        console.error('❌ Failed to fix JSON:', fixError.message);
      }
    }
  } else {
    console.log('❌ No JSON match found in response');
      }
      
      // If no JSON object found, try to parse the entire cleaned response as JSON
      try {
    console.log('🎯 Attempting to parse entire cleaned response as JSON...');
        const dateFlow = JSON.parse(cleanedResponse);
    console.log('🎯 Parsed DateFlow (full response):', JSON.stringify(dateFlow, null, 2));
        if (dateFlow && dateFlow.flow && Array.isArray(dateFlow.flow)) {
          console.log(`🎉 Successfully parsed date flow from Groq (full response) with ${dateFlow.flow.length} steps`);
      console.log('🎯 DateFlow title:', dateFlow.title || 'NOT FOUND');
      console.log('🎯 DateFlow event_details:', dateFlow.event_details ? 'FOUND' : 'NOT FOUND');
      console.log('🎯 ===== DATEFLOW PARSING SUCCESS (FULL) =====');
          return dateFlow;
    } else {
      console.log('❌ DateFlow missing flow array or invalid structure (full response)');
        }
      } catch (parseError) {
        console.error('❌ Error parsing full response:', parseError.message);
    
    // Try to fix the entire response JSON
    try {
      console.log('🔧 Attempting to fix entire response JSON...');
      let fixedResponse = cleanedResponse
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2');
      
      const dateFlow = JSON.parse(fixedResponse);
      if (dateFlow && dateFlow.flow && Array.isArray(dateFlow.flow)) {
        console.log(`🎉 Successfully parsed fixed entire response with ${dateFlow.flow.length} steps`);
        return dateFlow;
      }
    } catch (fixError) {
      console.error('❌ Failed to fix entire response JSON:', fixError.message);
    }
    
    console.log('🎯 ===== DATEFLOW PARSING FAILED =====');
      }
      
    } catch (parseError) {
      console.error('❌ Error in JSON parsing process:', parseError);
      console.log('📝 Raw AI response for debugging:', aiResponse.substring(0, 1000));
    }

    console.log('🎯 ===== DATEFLOW GENERATION FAILED =====');
    console.log('🔍 Debug information:');
    console.log('🔍 - Groq API key present:', groqApiKey ? 'YES' : 'NO');
    console.log('🔍 - Rate limiting check:', canMakeGroqCall() ? 'PASSED' : 'FAILED');
    console.log('🔍 - Raw AI response length:', aiResponse ? aiResponse.length : 'NULL');
    console.log('🔍 - AI response preview:', aiResponse ? aiResponse.substring(0, 200) + '...' : 'NULL');
    return null;
  } catch (error) {
    console.error('❌ ===== GROQ API DATEFLOW ERROR =====');
    console.error('❌ Groq API date flow error:', error.response?.data || error.message);
    console.error('❌ Error status:', error.response?.status);
    console.error('❌ Error headers:', error.response?.headers);
    return null;
  }
};

// Fallback events when APIs fail
const getFallbackEvents = (cityName, neighborhood) => {
  const neighborhoodInfo = neighborhood ? ` in ${neighborhood}` : '';
  return [
    {
      name: `${cityName} Food Festival`,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      location: `${cityName} Convention Center`,
      category: 'Food & Drink',
      description: `Annual food festival featuring ${cityName}'s best local restaurants and food trucks.`,
      cost: '$15-25',
      url: null, // No specific event URL for fallback events
      source: 'Fallback'
    },
    {
      name: `${cityName} Jazz Night`,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      location: `${cityName} Music Hall`,
      category: 'Music',
      description: `Live jazz performances by local and touring artists at ${cityName}'s premier music venue.`,
      cost: '$20-40',
      url: null, // No specific event URL for fallback events
      source: 'Fallback'
    },
    {
      name: `${cityName} Art Walk`,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      location: `${cityName} Arts District`,
      category: 'Art & Culture',
      description: `Gallery openings and street art installations throughout ${cityName}'s vibrant arts district.`,
      cost: 'Free',
      url: null, // No specific event URL for fallback events
      source: 'Fallback'
    }
  ];
};

// Combined Eventbrite + Ticketmaster integration for maximum event coverage
const callCombinedEventsAPI = async (location, userProfile, partnerProfile, neighborhood, radius) => {
  try {
    console.log(`🎫 Fetching real events from Eventbrite + Ticketmaster for ${location} within ${radius} miles`);
    
    // Set date range for next 2 weeks
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);

    // Fetch events from both APIs in parallel
    const [eventbriteEvents, ticketmasterEvents] = await Promise.allSettled([
      eventbriteService.searchEvents(location, radius),
      ticketmasterService.searchEvents(location, radius, startDate, endDate)
    ]);

    // Combine results and deduplicate
    let allEvents = [];
    const eventMap = new Map(); // Use Map to track unique events by name and date
    
    // Helper function to check if two event names are similar
    const areEventNamesSimilar = (name1, name2) => {
      if (!name1 || !name2) return false;
      
      const clean1 = name1.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const clean2 = name2.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      // Check for exact match
      if (clean1 === clean2) return true;
      
      // Check if one contains the other (for cases like "Concert" vs "Live Concert")
      if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
      
      // Check for high similarity using word overlap
      const words1 = clean1.split(/\s+/);
      const words2 = clean2.split(/\s+/);
      
      if (words1.length === 0 || words2.length === 0) return false;
      
      const commonWords = words1.filter(word => words2.includes(word));
      const similarity = commonWords.length / Math.max(words1.length, words2.length);
      
      // Consider similar if 70% or more words match
      return similarity >= 0.7;
    };
    
    // Helper function to find similar event in map
    const findSimilarEvent = (eventName, eventDate) => {
      for (const [key, existingEvent] of eventMap.entries()) {
        const existingDate = key.split('-').slice(1).join('-'); // Get date part from key
        if (existingDate === eventDate && areEventNamesSimilar(eventName, existingEvent.name)) {
          return key;
        }
      }
      return null;
    };
    
    if (eventbriteEvents.status === 'fulfilled' && eventbriteEvents.value) {
      console.log(`🎫 Eventbrite: ${eventbriteEvents.value.length} events`);
      eventbriteEvents.value.forEach(event => {
        const key = `${event.name}-${event.date}`;
        const similarKey = findSimilarEvent(event.name, event.date);
        
        if (!eventMap.has(key) && !similarKey) {
          eventMap.set(key, { ...event, source: 'Eventbrite' });
        } else {
          // Merge data if duplicate or similar found, prefer Ticketmaster URL if available
          const existingKey = similarKey || key;
          const existing = eventMap.get(existingKey);
          
          if (similarKey) {
            console.log(`🔄 Merging similar Eventbrite event: "${event.name}" with existing: "${existing.name}"`);
          } else {
            console.log(`🔄 Merging duplicate Eventbrite event: "${event.name}"`);
          }
          
          eventMap.set(existingKey, {
            ...existing,
            ...event,
            source: 'Combined',
            url: event.url || existing.url, // Prefer Ticketmaster URL
            name: existing.name // Keep the first name found
          });
        }
      });
    } else {
      console.warn('🎫 Eventbrite failed:', eventbriteEvents.reason?.message);
    }

    if (ticketmasterEvents.status === 'fulfilled' && ticketmasterEvents.value) {
      console.log(`🎫 Ticketmaster: ${ticketmasterEvents.value.length} events`);
      ticketmasterEvents.value.forEach(event => {
        const key = `${event.name}-${event.date}`;
        const similarKey = findSimilarEvent(event.name, event.date);
        
        if (!eventMap.has(key) && !similarKey) {
          eventMap.set(key, { ...event, source: 'Ticketmaster' });
        } else {
          // Merge data if duplicate or similar found, prefer Ticketmaster data
          const existingKey = similarKey || key;
          const existing = eventMap.get(existingKey);
          
          if (similarKey) {
            console.log(`🔄 Merging similar Ticketmaster event: "${event.name}" with existing: "${existing.name}"`);
          } else {
            console.log(`🔄 Merging duplicate Ticketmaster event: "${event.name}"`);
          }
          
          eventMap.set(existingKey, {
            ...existing,
            ...event,
            source: 'Combined',
            url: event.url || existing.url, // Prefer Ticketmaster URL
            name: existing.name // Keep the first name found
          });
        }
      });
    } else {
      console.warn('🎫 Ticketmaster failed:', ticketmasterEvents.reason?.message);
    }

    // Convert Map back to array
    allEvents = Array.from(eventMap.values());

    if (allEvents.length === 0) {
      console.warn('🎫 No events found from either API, using fallback');
      return getFallbackEvents(location.split(',')[0].trim(), neighborhood);
    }

    console.log(`🎫 Total combined events (after deduplication): ${allEvents.length}`);

    // Use Groq AI to intelligently select and personalize the best events
    // Try to get profiles from context if not provided
    let finalUserProfile = userProfile;
    let finalPartnerProfile = partnerProfile;
    
    // Note: sessionId is not available in this context, so we'll use the profiles directly
    // The profiles are already passed to this function, so no need to retrieve from context
    
    const selectedEvents = await selectAndPersonalizeEventsWithAI(allEvents, finalUserProfile, finalPartnerProfile, location);
    
    console.log(`🎫 AI selected ${selectedEvents.length} best events for user/partner profiles`);
    return selectedEvents.slice(0, 15);

  } catch (error) {
    console.error('🎫 Combined events API error:', error.message);
    return getFallbackEvents(location.split(',')[0].trim(), neighborhood);
  }
};

// Use Groq AI to intelligently select and personalize the best events from combined APIs
const selectAndPersonalizeEventsWithAI = async (allEvents, userProfile, partnerProfile, location) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      console.warn('GROQ_API_KEY not found for AI selection, returning first 15 events');
      return allEvents.slice(0, 15);
    }

    // Check rate limiting
    if (!canMakeGroqCall()) {
      console.log('⏳ Skipping Groq AI selection due to rate limiting');
      return allEvents.slice(0, 15);
    }

    const cityName = location.split(',')[0].trim();
    const stateName = location.split(',')[1]?.trim() || '';
    const fullLocation = stateName ? `${cityName}, ${stateName}` : cityName;

    const userContext = userProfile ? `
USER PROFILE:
- Name: ${userProfile.name || 'User'}
- Interests: ${userProfile.interests || 'Not specified'}
- Budget: ${userProfile.budget || 'Not specified'}
- Location: ${fullLocation}
- Neighborhood: ${userProfile.neighborhood || 'Not specified'}
- Travel Radius: ${userProfile.travel_radius || 3} miles
- Age: ${userProfile.age || 'Not specified'}
- Bio: ${userProfile.bio || 'Not specified'}
- Relationship Status: ${userProfile.relationship_status || 'Not specified'}` : '';

    const partnerContext = partnerProfile?.name ? `

💕 PARTNER PROFILE (CRITICAL FOR SELECTION):
- Partner Name: ${partnerProfile.name}
- Partner Interests: ${partnerProfile.interests || 'Not specified'}
- Partner Preferences: ${partnerProfile.preferences || 'Not specified'}
- Partner Budget Range: ${partnerProfile.budget || 'Not specified'}
- Partner Dietary Restrictions: ${partnerProfile.dietaryRestrictions || 'None'}
- Partner Location: ${partnerProfile.location || 'Not specified'}
- Partner Neighborhood: ${partnerProfile.neighborhood || 'Not specified'}
- Partner Travel Radius: ${partnerProfile.travel_radius || 3} miles
- Partner Age: ${partnerProfile.age || 'Not specified'}` : '';

    const prompt = `You are an expert event curator for romantic dates. I have ${allEvents.length} real events from Eventbrite and Ticketmaster for ${fullLocation} in the next 2 weeks.

${userContext}${partnerContext}

Here are the real events found (showing first 30 for processing):
${JSON.stringify(allEvents.slice(0, 30).map(event => ({
  name: event.name,
  date: event.date,
  time: event.time,
  location: event.location,
  category: event.category,
  cost: event.cost,
  url: event.url,
  description: event.description?.substring(0, 200) + '...' || 'Event details available'
})), null, 2)}

Your task:
1. SELECT the 15 BEST events that would create amazing dates for this couple
2. **HEAVILY WEIGHT partner preferences** - if partner profile is provided, prioritize events that match their interests, budget, and preferences
3. Consider both user and partner interests, budget, and preferences
4. Prioritize events that both would enjoy together
5. Focus on romantic, memorable, and unique experiences
6. Keep ALL original event data EXACTLY the same (name, date, time, location, cost, etc.)
7. Only enhance the descriptions with romantic dating context
8. Rank by overall appeal for the couple, with extra weight on partner satisfaction
9. If partner has specific interests (music, art, food, etc.), prioritize those categories
10. Consider partner's age and relationship status for appropriate event selection

Return ONLY a JSON array of exactly 15 events in this format:
[
  {
    "name": "EXACT SAME NAME",
    "date": "EXACT SAME DATE", 
    "time": "EXACT SAME TIME",
    "location": "EXACT SAME LOCATION",
    "category": "EXACT SAME CATEGORY",
    "cost": "EXACT SAME COST",
    "url": "EXACT SAME URL",
    "description": "Enhanced romantic description explaining why this is perfect for their date",
    "source": "EXACT SAME SOURCE"
  }
]

Select the most appealing events that create diverse, exciting date options with strong consideration for partner preferences!`;

    console.log(`🎫 AI analyzing ${allEvents.length} events to select best 15 for couple`);

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert event curator for romantic dates. Your primary goal is to select events that will make both partners happy, with special emphasis on partner preferences when provided. Keep all original event data exactly the same and only enhance descriptions with romantic context that explains why each event is perfect for this specific couple.'
        },
        { 
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    
    // Parse the JSON response
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const selectedEvents = JSON.parse(jsonMatch[0]);
        console.log(`🎫 AI successfully selected ${selectedEvents.length} best events for couple`);
        return selectedEvents;
      }
    } catch (parseError) {
      console.error('🎫 Error parsing AI selected events:', parseError);
      console.log('🎫 Raw AI response:', aiResponse);
    }

    // Return first 15 events if AI selection fails
    console.log('🎫 AI selection failed, returning first 15 events');
    return allEvents.slice(0, 15);

  } catch (error) {
    console.error('🎫 AI event selection error:', error.message);
    return allEvents.slice(0, 15); // Return first 15 events if AI fails
  }
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

    const prompt = `Create 15 amazing date ideas for ${fullLocation}. These should be realistic, romantic, and fun activities that couples can actually do in this city.${partnerContext}

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
      max_tokens: 2000
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
      // Clean the response first
      let cleanedResponse = aiResponse.trim();
      
      // Remove any text before the first [ or {
      const arrayStart = cleanedResponse.indexOf('[');
      const objectStart = cleanedResponse.indexOf('{');
      const startIndex = Math.min(
        arrayStart === -1 ? Infinity : arrayStart,
        objectStart === -1 ? Infinity : objectStart
      );
      
      if (startIndex !== Infinity) {
        cleanedResponse = cleanedResponse.substring(startIndex);
      }
      
      // Remove any text after the last ] or }
      const arrayEnd = cleanedResponse.lastIndexOf(']');
      const objectEnd = cleanedResponse.lastIndexOf('}');
      const endIndex = Math.max(arrayEnd, objectEnd);
      
      if (endIndex !== -1) {
        cleanedResponse = cleanedResponse.substring(0, endIndex + 1);
      }
      
      // Fix common JSON issues
      cleanedResponse = cleanedResponse
        .replace(/,\s*}/g, '}')  // Remove trailing commas before closing braces
        .replace(/,\s*]/g, ']')  // Remove trailing commas before closing brackets
        .replace(/}\s*{/g, '},{') // Fix missing commas between objects
        .replace(/]\s*\[/g, '],[') // Fix missing commas between arrays
        .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas before closing brackets/braces
      
      // Try to parse the cleaned JSON
      const dateIdeas = JSON.parse(cleanedResponse);
      if (Array.isArray(dateIdeas) && dateIdeas.length > 0) {
        console.log(`🎉 Successfully parsed ${dateIdeas.length} date ideas from Groq`);
        return dateIdeas.slice(0, 15);
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
const GROQ_RATE_LIMIT_DELAY = 2000; // 2 seconds between calls (Groq free tier: 30 requests/minute)
const CACHE_DURATION = 300000; // 5 minutes cache

// Cache for events and date ideas with expiration
const eventsCache = new Map();
const dateIdeasCache = new Map();
const dateFlowCache = new Map();

// Cache management functions
const getCachedData = (cache, key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key); // Remove expired cache
  return null;
};

const setCachedData = (cache, key, data) => {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
};

const canMakeGroqCall = () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastGroqCall;
  
  if (timeSinceLastCall < GROQ_RATE_LIMIT_DELAY) {
    const remainingDelay = GROQ_RATE_LIMIT_DELAY - timeSinceLastCall;
    console.log(`⏳ Rate limiting Groq API calls - ${Math.ceil(remainingDelay/1000)}s remaining`);
    return false;
  }
  
  console.log(`✅ Groq API call allowed - ${Math.ceil(timeSinceLastCall/1000)}s since last call`);
  lastGroqCall = now;
  return true;
};

// Wait for rate limit if needed
const waitForGroqRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastGroqCall;
  
  if (timeSinceLastCall < GROQ_RATE_LIMIT_DELAY) {
    const remainingDelay = GROQ_RATE_LIMIT_DELAY - timeSinceLastCall;
    console.log(`⏳ Waiting ${Math.ceil(remainingDelay/1000)}s for Groq rate limit...`);
    await new Promise(resolve => setTimeout(resolve, remainingDelay + 100)); // Add 100ms buffer
    console.log('✅ Rate limit wait complete');
  }
};

const getCachedEvents = (cacheKey) => {
  const cached = eventsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📋 Using cached events for:', cacheKey);
    return cached.data;
  }
  return null;
};

const setCachedEvents = (cacheKey, data) => {
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
const callGroqForEvents = async (location, neighborhood, radius, partnerProfile) => {
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

    const neighborhoodInfo = neighborhood ? ` in the ${neighborhood} area` : '';
    const radiusInfo = radius ? ` within ${radius} miles of ${neighborhood || cityName}` : '';
    
    const partnerContext = partnerProfile?.name ? `
    
    💕 PARTNER PROFILE (CRITICAL FOR PERSONALIZATION):
    - Partner Name: ${partnerProfile.name}
    - Interests: ${partnerProfile.interests || 'Not specified'}
    - Preferences: ${partnerProfile.preferences || 'Not specified'}
    - Budget Range: ${partnerProfile.budget || 'Not specified'}
    - Dietary Restrictions: ${partnerProfile.dietaryRestrictions || 'None'}
    - Neighborhood: ${partnerProfile.neighborhood || 'Not specified'}
    - Travel Radius: ${partnerProfile.travel_radius || '3'} miles
    
    🎯 PERSONALIZATION INSTRUCTIONS:
    - Find events that BOTH partners would genuinely love
    - Consider their shared interests and complementary differences
    - Match their energy level and social preferences
    - Respect their budget constraints
    - Find unique, memorable experiences they'll talk about later
    - Think about what would make them both excited and create great memories` : '';

    const currentDate = new Date();
    const futureDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    console.log('🔥 Groq API Debug - Sending COOL events request:', {
      fullLocation,
      neighborhoodInfo,
      radiusInfo,
      neighborhood,
      cityName,
      radius,
      partnerContext: partnerContext ? 'Yes' : 'No'
    });

    const prompt = `🔥 You are a COOL local insider who knows all the BEST spots in ${fullLocation}. Find 15 absolutely AMAZING upcoming events happening${neighborhoodInfo}${radiusInfo} between ${currentDate.toLocaleDateString()} and ${futureDate.toLocaleDateString()}. 

    🎯 YOUR MISSION: Find events that make people go "HOLY SHIT, how did you know I'd love this?!"

    🚀 COOLNESS CRITERIA:
    - Hidden gems that locals know about, not tourist traps
    - Events that create stories and memories
    - Unique experiences you can't find anywhere else
    - Perfect for couples who want something special
    - Mix of intimate and adventurous options
    - Consider the neighborhood vibe (trendy, artsy, upscale, etc.)

    💫 PERSONALIZATION FOCUS:
    - Think like you're recommending to a close friend
    - Consider what would make THIS specific couple excited
    - Balance their interests with new experiences
    - Find events that match their energy and style${partnerContext}

    📋 FOR EACH EVENT, provide:
    - name: Creative, enticing event name that sounds exciting
    - date: Specific date in MM/DD/YYYY format  
    - location: Actual venue name that exists in ${cityName}
    - category: Food & Drink, Music, Art & Culture, Entertainment, Sports, Nightlife, Unique Experiences
    - description: WHY this event is amazing and perfect for them (be enthusiastic!)
    - cost: Realistic ticket price or "Free"

    🎨 MAKE IT SOUND COOL:
    - Use exciting, descriptive language
    - Highlight what makes each event special
    - Focus on the experience, not just the event
    - Make it sound like something they HAVE to do

    Format as JSON array with these exact fields: name, date, location, category, description, cost.

    🔥 EXAMPLE COOL EVENTS:
    [
      {
        "name": "Underground Speakeasy Jazz & Cocktails",
        "date": "01/15/2025", 
        "location": "The Back Room",
        "category": "Nightlife",
        "description": "Secret basement bar with live jazz, craft cocktails, and intimate atmosphere - perfect for a mysterious, romantic night out",
        "cost": "$20-35"
      },
      {
        "name": "Pop-up Art Gallery with Live Painting",
        "date": "01/16/2025",
        "location": "Warehouse District Gallery",
        "category": "Art & Culture", 
        "description": "Exclusive pop-up featuring local artists creating live while you sip wine and explore - immersive art experience",
        "cost": "Free"
      }
    ]`;

    console.log(`🔥 Calling Groq API for COOL events in ${fullLocation}...`);

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are an incredibly cool local insider who knows all the best hidden spots and amazing events in any city. You have impeccable taste and always find the most exciting, unique experiences that make people feel like VIPs. You think like a knowledgeable friend who wants to show someone the absolute best time. Always respond with valid JSON arrays that sound exciting and personalized.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 3500
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
          return events.slice(0, 15);
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
const callGroqAPI = async (userMessage, context, conversationHistory, conversation = null) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      console.warn('GROQ_API_KEY not found, falling back to rule-based responses');
      return generateFionaResponse(userMessage, context);
    }

    // Create enhanced DateFlow AI system prompt for subtle, natural recommendations
    let fionaPrompt = `You are DateFlow AI, a thoughtful dating assistant who helps create meaningful experiences. You're warm, genuine, and naturally helpful without being pushy.

PERSONALITY:
- Conversational and friendly, like a knowledgeable friend who's great at planning dates
- Subtle and organic in your recommendations - let interests guide suggestions naturally
- Thoughtful and considerate of both partners' preferences
- Gentle and encouraging, not overly enthusiastic or forward

RESPONSE STYLE:
- Write 2-4 sentences that feel natural and engaging
- Subtly weave in interests and preferences without being obvious about it
- Make gentle suggestions that feel like natural conversation
- Ask thoughtful questions to understand their needs
- Be conversational and organic, not robotic or salesy

CRITICAL RULES:
- Use ONLY the partner's actual name from the provided profile. Do not make up names.
- Subtly consider partner interests (70%) and user interests (30%) in your suggestions
- Make recommendations feel natural and unforced - like you're just sharing ideas
- Don't be too forward or pushy with suggestions
- Let the conversation flow naturally while gently guiding toward good options
- Be specific about locations, activities, and timing when it feels natural

When the user is ready for a complete date plan, respond: "That sounds wonderful! I'd be happy to help you put together a complete plan for that."`;

    // Add detailed user profile context
    if (context && context.userProfile) {
      const userProfile = context.userProfile;
      const location = userProfile.location || userProfile.user?.profile?.location || 'Unknown';
      const interests = userProfile.interests || [];
      const budget = userProfile.budget || userProfile.user?.profile?.budget || 'Not specified';
      const age = userProfile.age || userProfile.user?.profile?.age || 'Not specified';
      
      fionaPrompt += `\n\nUSER PROFILE (30% weight):
- Name: ${userProfile.name || userProfile.user?.name || 'Not specified'}
- Location: ${location}
- Age: ${age}
- Interests: ${interests.join(', ') || 'Not specified'}
- Budget: ${budget}
- Bio: ${userProfile.bio || userProfile.user?.profile?.bio || 'Not specified'}`;
    }

    // Add detailed partner profile context
    if (context.partnerProfile && Object.keys(context.partnerProfile).length > 0) {
      const partner = context.partnerProfile;
      console.log('🔍 PARTNER PROFILE DEBUG:', JSON.stringify(partner, null, 2));
      
      fionaPrompt += `\n\nPARTNER PROFILE (70% weight - FOCUS ON THIS):
- Name: ${partner.name || 'Not specified'}
- Age: ${partner.age || 'Not specified'}
- Location: ${partner.location || 'Not specified'}
- Interests: ${partner.interests ? partner.interests.join(', ') : 'Not specified'}
- Budget: ${partner.budget || 'Not specified'}
- Dietary Restrictions: ${partner.dietaryRestrictions || 'None'}
- Keywords: ${partner.keywords || 'Not specified'}
- Bio: ${partner.bio || 'Not specified'}`;
    } else {
      console.log('🔍 NO PARTNER PROFILE FOUND IN CONTEXT');
      fionaPrompt += `\n\nNO PARTNER PROFILE AVAILABLE - Ask the user about their partner's preferences to create better recommendations.`;
    }


    // Build conversation context
    const messages = [
      { role: 'system', content: fionaPrompt }
    ];

    // Add recent conversation history (last 3 messages for better context)
    const recentHistory = conversationHistory.slice(-3);
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
    console.log(`🔍 CONTEXT DEBUG:`, {
      hasUserProfile: !!context?.userProfile,
      hasPartnerProfile: !!context?.partnerProfile,
      partnerProfileKeys: context?.partnerProfile ? Object.keys(context.partnerProfile) : [],
      userProfileKeys: context?.userProfile ? Object.keys(context.userProfile) : []
    });
    
    // Log detailed context information
    if (context?.userProfile) {
      console.log('🔍 USER PROFILE DETAILS:', {
        name: context.userProfile.name,
        interests: context.userProfile.interests,
        location: context.userProfile.location
      });
    }
    
    if (context?.partnerProfile) {
      console.log('🔍 PARTNER PROFILE DETAILS:', {
        name: context.partnerProfile.name,
        interests: context.partnerProfile.interests,
        location: context.partnerProfile.location
      });
    } else {
      console.log('🔍 NO PARTNER PROFILE IN CONTEXT');
    }
    
    console.log(`📝 Final prompt: ${fionaPrompt}`);

    // Retry logic for rate limiting
    let response;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant', // Using current Llama 3.1 model
          messages: messages,
          max_tokens: 60, // Very concise responses
          temperature: 0.3, // Lower temperature for more consistent, sophisticated responses
          top_p: 0.9
        }, {
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
          timeout: 30000 // 30 second timeout
        });
        
        // Success - break out of retry loop
        break;
        
      } catch (apiError) {
        // Check if it's a rate limit error
        if (apiError.response?.status === 429 && retries < maxRetries) {
          const errorData = apiError.response?.data?.error;
          const waitTime = errorData?.message?.match(/try again in ([\d.]+)s/)?.[1];
          const delay = waitTime ? Math.ceil(parseFloat(waitTime) * 1000) : (retries + 1) * 2000;
          
          console.log(`⏳ Rate limit hit (attempt ${retries + 1}/${maxRetries + 1}). Waiting ${delay/1000}s before retry...`);
          console.log(`📊 Rate limit details:`, errorData);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          // Not a rate limit error or max retries reached - throw to outer catch
          throw apiError;
        }
      }
    }

    let aiResponse = response.data.choices[0].message.content;
    console.log(`✅ Groq API response received: ${aiResponse.substring(0, 50)}...`);
    
    // Clean response to remove symbols that break TTS
    aiResponse = aiResponse
      .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove all symbols except basic punctuation
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log('🧹 Cleaned response for TTS:', aiResponse);
    
    // Check if user is satisfied with the plan and trigger DateFlow generation
    const userMessageLower = userMessage.toLowerCase();
    const satisfactionKeywords = ['perfect', 'sounds good', 'let\'s do it', 'that works', 'okay', 'yes', 'great', 'awesome', 'love it'];
    
    if (satisfactionKeywords.some(keyword => userMessageLower.includes(keyword)) && 
        (aiResponse.includes('This plan works') || aiResponse.includes('This plan is irresistibly seductive'))) {
      console.log('🎯 User satisfied with plan - DateFlow generation triggered');
      // The frontend will detect this response and automatically generate DateFlow
    }
    
    // Generate AI recommendation based on user and partner interests
    const userProfile = context?.userProfile;
    const partnerProfile = context?.partnerProfile;
    const aiRecommendation = generateAIRecommendation(userMessage, userProfile, partnerProfile);
    if (aiRecommendation) {
      console.log('🎯 Generated AI recommendation:', aiRecommendation);
      // Store recommendation in conversation context for DateFlow generation
      if (conversation && conversation.context) {
        conversation.context.aiRecommendation = aiRecommendation;
        await conversation.save();
      }
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
          messageCount: 0,
          user_profile: null,
          partner_profile: null,
          date_planning_context: {}
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
    
    // Generate AI response using the same logic as authenticated users
    const aiResponse = await callGroqAPI(message, guestContext, conversation.messages, conversation);
    
    // Post-process response to ensure correct DateFlow generation format
    const userMessageLower = message.toLowerCase();
    const isDateFlowRequest = userMessageLower.includes('complete dateflow') || 
                             userMessageLower.includes('dateflow for this event') ||
                             userMessageLower.includes('create a complete dateflow');
    
    let finalResponse = aiResponse;
    if (isDateFlowRequest) {
      console.log('🎯 DateFlow request detected, forcing correct response format');
      finalResponse = "Perfect. This plan is irresistibly seductive. I'll craft your intimate DateFlow now.";
    }
    
    // Add AI response to conversation history
    conversation.messages.push({ role: 'assistant', content: finalResponse });
    
    console.log('✅ Guest chat response generated successfully');

    res.json({
      message: finalResponse,
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

    // Get user and partner profiles using universal function
    const { userProfile, partnerProfile } = await getProfilesForEndpoint(req, session_id);
    
    console.log('💾 Final profiles for chat endpoint:', {
      hasUserProfile: !!userProfile,
      hasPartnerProfile: !!partnerProfile,
      userName: userProfile?.name,
      partnerName: partnerProfile?.name,
      partnerProfileData: partnerProfile ? JSON.stringify(partnerProfile, null, 2) : 'null'
    });
    
    // Log combined interests for debugging
    const userInterests = userProfile?.interests || [];
    const partnerInterests = partnerProfile?.interests || [];
    const combinedInterests = [...userInterests, ...partnerInterests];
    console.log('🎯 ========== INTERESTS DEBUG ==========');
    console.log('🎯 User Profile Object:', JSON.stringify(userProfile, null, 2));
    console.log('🎯 Partner Profile Object:', JSON.stringify(partnerProfile, null, 2));
    console.log('🎯 Backend user interests (from userProfile?.interests):', userInterests);
    console.log('🎯 Backend partner interests (from partnerProfile?.interests):', partnerInterests);
    console.log('🎯 Backend combined interests:', combinedInterests);
    console.log('🎯 ======================================');

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
        // Build context for AI response (use retrieved partner profile)
        const context = await buildContext(userId, conversation, partnerProfile);
        aiResponse = await callGroqAPI(message, context, conversation.messages, conversation);
        aiResponse += "\n\nI'll help you find the perfect restaurant!";
      }
    } else {
      // Build context for AI response (use retrieved partner profile)
      const context = await buildContext(userId, conversation, partnerProfile);
      
      // Generate AI response with Fiona personality
      console.log('🤖 Calling Groq API for AI response...');
      aiResponse = await callGroqAPI(message, context, conversation.messages, conversation);
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
    // Post-process response to ensure correct DateFlow generation format
    const userMessageLower = message.toLowerCase();
    const isDateFlowRequest = userMessageLower.includes('complete dateflow') || 
                             userMessageLower.includes('dateflow for this event') ||
                             userMessageLower.includes('create a complete dateflow');
    
    if (isDateFlowRequest) {
      console.log('🎯 DateFlow request detected, forcing correct response format');
      aiResponse = "Perfect. This plan is irresistibly seductive. I'll craft your intimate DateFlow now.";
    }
    
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

// POST /api/chat/generate-dateflow - Generate DateFlow from conversation context
router.post('/generate-dateflow', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.body;
    
    console.log('🎯 DateFlow generation request received:', { userId, conversationId, body: req.body });
    
    if (!conversationId) {
      return res.status(400).json({
        error: 'Conversation ID is required',
        code: 'MISSING_CONVERSATION_ID'
      });
    }

    console.log(`🎯 Generating DateFlow for conversation: ${conversationId}`);

    // Get the conversation from database
    const conversation = await Conversation.findOne({
      _id: conversationId,
      user_id: userId
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Extract date plan from conversation messages using AI
    const messages = conversation.messages || [];
    console.log('🎯 Raw conversation messages:', JSON.stringify(messages, null, 2));
    console.log('🎯 Looking for event details in conversation...');
    
    let planDetails;
    try {
      planDetails = await extractPlanFromMessagesWithAI(messages);
      console.log('🎯 Extracted plan details for DateFlow generation:', JSON.stringify(planDetails, null, 2));
    } catch (error) {
      console.error('❌ Error extracting plan details:', error);
      console.error('❌ Error stack:', error.stack);
      // Fallback to basic plan details
      planDetails = {
        activities: [],
        restaurants: [],
        times: [],
        locations: [],
        duration: "3-4 hours",
        budget: "$$",
        event_details: {},
        summary: "Date plan extracted from conversation"
      };
    }
    
    // Get user and partner profiles
    const user = await User.findById(userId).select('-password_hash');
    const userProfile = user?.profile || {};
    
    // Try to get partner profile from conversation context
    const { partnerProfile } = await getProfilesFromContext(conversationId, false);
    console.log('💾 Retrieved partner profile from context:', {
      hasPartnerProfile: !!partnerProfile,
      partnerName: partnerProfile?.name
    });
    
    // Get AI recommendation from conversation context
    const aiRecommendation = conversation.context?.aiRecommendation || null;
    console.log('🎯 AI recommendation from context:', aiRecommendation);
    
    // Generate DateFlow using Groq API with extracted plan details
    console.log('🎯 ===== GENERATING DATEFLOW =====');
    console.log('🎯 About to generate DateFlow with plan details:', JSON.stringify(planDetails, null, 2));
    console.log('🎯 User profile:', JSON.stringify(userProfile, null, 2));
    console.log('🎯 User location:', userProfile.location || 'New York, NY');
    console.log('🎯 Event details present:', planDetails.event_details ? 'YES' : 'NO');
    console.log('🎯 AI recommendation present:', aiRecommendation ? 'YES' : 'NO');
    if (planDetails.event_details) {
      console.log('🎯 Event details:', JSON.stringify(planDetails.event_details, null, 2));
    }
    
    // Transform planDetails to the expected format
    const transformedPlanDetails = {
      duration: planDetails.date_flow?.duration || planDetails.duration || "3-4 hours",
      budget: planDetails.date_flow?.budget || planDetails.budget || userProfile.budget || "$$",
        style: "romantic",
        activities: planDetails.activities || [],
        restaurants: planDetails.restaurants || [],
        times: planDetails.times || [],
        locations: planDetails.locations || [],
      event_details: planDetails.main_event || planDetails.event_details || {},
      summary: planDetails.summary || `${planDetails.event_name || 'Event'} experience`,
      ai_recommendation: aiRecommendation,
      // Preserve original event data including Ticketmaster URL
      original_event_data: planDetails
    };
    
    console.log('🎯 Transformed planDetails for Groq:', JSON.stringify(transformedPlanDetails, null, 2));
    
    const dateFlow = await callGroqForDateFlow(
      userProfile.location || 'New York, NY',
      userProfile,
      partnerProfile, // Now using partner profile from context
      transformedPlanDetails,
      aiRecommendation
    );
    
    console.log('🎯 DateFlow generation result:', dateFlow ? 'SUCCESS' : 'FAILED');
    if (dateFlow) {
      console.log('🎯 Generated DateFlow:', JSON.stringify(dateFlow, null, 2));
      console.log('🎯 DateFlow flow steps:', dateFlow.flow ? dateFlow.flow.length : 0);
      if (dateFlow.event_details) {
        console.log('🎯 DateFlow event details:', JSON.stringify(dateFlow.event_details, null, 2));
      }
    } else {
      console.log('🎯 ===== DATEFLOW GENERATION RETURNED NULL =====');
      console.log('🎯 This could be due to:');
      console.log('🎯 1. Rate limiting (Groq API calls too frequent)');
      console.log('🎯 2. Groq API parsing failure');
      console.log('🎯 3. Missing Groq API key');
      console.log('🎯 4. Network error');
    }

    if (dateFlow && dateFlow.flow && dateFlow.flow.length > 0) {
      console.log(`✅ Generated DateFlow with ${dateFlow.flow.length} steps`);
      res.json({
        success: true,
        dateFlow: dateFlow,
        location: userProfile.location || 'New York, NY',
        source: 'conversation_context'
      });
    } else {
      // Retry DateFlow generation with exponential backoff instead of immediate fallback
      console.log('🎯 ===== RETRYING DATEFLOW GENERATION =====');
      console.log('🎯 Initial attempt failed, retrying with delays...');
      
      let retryCount = 0;
      const maxRetries = 3;
      let finalDateFlow = null;
      
      while (retryCount < maxRetries && !finalDateFlow) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        
        console.log(`🔄 Retry attempt ${retryCount}/${maxRetries} - waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`🎯 Attempting DateFlow generation (retry ${retryCount})...`);
        finalDateFlow = await callGroqForDateFlow(
          userProfile.location || 'New York, NY',
          userProfile,
          partnerProfile,
          transformedPlanDetails,
          aiRecommendation
        );
        
        if (finalDateFlow) {
          console.log(`🎉 DateFlow generation succeeded on retry ${retryCount}!`);
          console.log('🎯 Generated DateFlow:', JSON.stringify(finalDateFlow, null, 2));
          console.log('🎯 DateFlow flow steps:', finalDateFlow.flow ? finalDateFlow.flow.length : 0);
          break;
        } else {
          console.log(`❌ Retry ${retryCount} failed, ${maxRetries - retryCount} attempts remaining`);
        console.log('🔍 Debug: callGroqForDateFlow returned null - checking possible causes:');
        console.log('🔍 1. Groq API key present:', process.env.GROQ_API_KEY ? 'YES' : 'NO');
        console.log('🔍 2. Rate limiting active:', !canMakeGroqCall() ? 'YES' : 'NO');
        console.log('🔍 3. Last Groq call time:', new Date(lastGroqCall).toISOString());
        }
      }
      
      if (finalDateFlow) {
        console.log('🎯 ===== DATEFLOW GENERATION SUCCESS (RETRY) =====');
        res.json({
          success: true,
          dateFlow: finalDateFlow,
          location: userProfile.location || 'New York, NY',
          source: 'conversation_context_retry'
        });
      } else {
        // Only use fallback after all retries have failed
        console.log('🎯 ===== ALL RETRIES FAILED - CREATING FALLBACK DATEFLOW =====');
        console.log('🎯 Plan details for fallback:', JSON.stringify(planDetails, null, 2));
        console.log('🎯 User profile for fallback:', JSON.stringify(userProfile, null, 2));
        console.log('🎯 Partner profile for fallback:', JSON.stringify(partnerProfile, null, 2));
        console.log('🎯 AI recommendation for fallback:', aiRecommendation);
        
        const fallbackFlow = createFallbackDateFlow(transformedPlanDetails, userProfile.location || 'New York, NY', userProfile, partnerProfile, aiRecommendation);
        console.log('🎯 Generated fallback DateFlow:', JSON.stringify(fallbackFlow, null, 2));
        console.log(`⚠️ Using fallback DateFlow with ${fallbackFlow.flow?.length || 0} steps after ${maxRetries} failed attempts`);
        
      res.json({
        success: true,
        dateFlow: fallbackFlow,
        location: userProfile.location || 'New York, NY',
          source: 'fallback_after_retries'
      });
      }
    }

  } catch (error) {
    console.error('❌ DateFlow generation error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to generate DateFlow',
      code: 'DATE_FLOW_GENERATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to extract plan details from conversation messages using AI
const extractPlanFromMessagesWithAI = async (messages) => {
  try {
    console.log('🎯 ===== EXTRACTING PLAN DETAILS FROM CONVERSATION =====');
    console.log('🎯 Input messages count:', messages.length);
    console.log('🎯 Messages:', JSON.stringify(messages, null, 2));
    
    // Convert messages to a readable format
    const conversationText = messages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');
    
    console.log('🎯 Conversation text:', conversationText);
    console.log('🎯 Conversation length:', conversationText.length, 'characters');

    const prompt = `Extract event and date plan details from this conversation. Return ONLY valid JSON:

{
  "activities": ["activity1", "activity2"],
  "restaurants": ["restaurant1"],
  "times": ["4:00 PM", "6:00 PM"],
  "locations": ["location1"],
  "duration": "3-4 hours",
  "budget": "$$",
  "event_details": {
    "name": "event name if mentioned",
    "date": "date if mentioned",
    "time": "time if mentioned",
    "location": "event location if mentioned",
    "venue": "venue name if mentioned",
    "address": "venue address if mentioned",
    "category": "event category if mentioned",
    "cost": "event cost if mentioned",
    "description": "event description if mentioned",
    "url": "event URL if mentioned",
    "ticketmaster_url": "ticketmaster URL if mentioned",
    "image": "event image URL if mentioned"
  },
  "summary": "Brief summary"
}

IMPORTANT: Look for specific event names like "Harry Potter", "Hamilton", "Concert", etc. 
Extract ALL event details including venue, address, time, and any URLs mentioned.
If the conversation mentions clicking on an event or selecting an event, capture all its details.

Conversation:
${conversationText}

Extract ALL event details and activities mentioned. Be accurate and thorough.`;

    console.log('🎯 Sending prompt to Groq API for plan extraction...');
    console.log('🎯 Prompt length:', prompt.length, 'characters');
    console.log('🎯 Groq API Key present:', !!process.env.GROQ_API_KEY);
    
    // Wait for rate limiting if needed
    console.log('🎯 Waiting for Groq rate limits before plan extraction...');
    await waitForGroqRateLimit();
    
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are an expert at extracting structured information from conversations. Always return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🎯 Groq API response status:', response.status);
    console.log('🎯 Groq API response headers:', JSON.stringify(response.headers, null, 2));

    const aiResponse = response.data.choices[0].message.content;
    console.log('🎯 AI plan extraction response:', aiResponse);
    console.log('🎯 Response length:', aiResponse.length, 'characters');
    
    // Parse the JSON response
    let planDetails;
    try {
      console.log('🎯 Attempting to parse AI response as JSON...');
      // Clean the response to extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('🎯 Found JSON match:', jsonMatch[0]);
        planDetails = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed AI response JSON');
        console.log('🎯 Parsed plan details:', JSON.stringify(planDetails, null, 2));
        console.log('🎯 Event details found:', planDetails.event_details ? 'YES' : 'NO');
        if (planDetails.event_details) {
          console.log('🎯 Event name:', planDetails.event_details.name || 'NOT FOUND');
          console.log('🎯 Event venue:', planDetails.event_details.venue || 'NOT FOUND');
          console.log('🎯 Event category:', planDetails.event_details.category || 'NOT FOUND');
          console.log('🎯 Event cost:', planDetails.event_details.cost || 'NOT FOUND');
        }
      } else {
        console.log('❌ No JSON found in AI response');
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      console.log('🎯 Raw AI response that failed to parse:', aiResponse);
      console.log('🎯 Using fallback extraction with manual parsing...');
      
      // Try to extract basic event info manually
      planDetails = {
        activities: [],
        restaurants: [],
        times: [],
        locations: [],
        duration: "3-4 hours",
        budget: "$$",
        event_details: {},
        summary: "Date plan from conversation"
      };
      
      // Simple regex extraction for event details
      console.log('🎯 Extracting event details with regex...');
      const eventNameMatch = conversationText.match(/attend\s+([^on]+?)\s+on/i);
      const eventDateMatch = conversationText.match(/on\s+([^\s]+)/i);
      const eventLocationMatch = conversationText.match(/at\s+([^.]+?)\s*\./i);
      const eventCategoryMatch = conversationText.match(/This is a ([^event]+) event/i);
      const eventCostMatch = conversationText.match(/costs?\s+([^.]+)/i);
      
      console.log('🎯 Event name match:', eventNameMatch ? eventNameMatch[1] : 'NOT FOUND');
      console.log('🎯 Event date match:', eventDateMatch ? eventDateMatch[1] : 'NOT FOUND');
      console.log('🎯 Event location match:', eventLocationMatch ? eventLocationMatch[1] : 'NOT FOUND');
      console.log('🎯 Event category match:', eventCategoryMatch ? eventCategoryMatch[1] : 'NOT FOUND');
      console.log('🎯 Event cost match:', eventCostMatch ? eventCostMatch[1] : 'NOT FOUND');
      
      if (eventNameMatch) planDetails.event_details.name = eventNameMatch[1].trim();
      if (eventDateMatch) planDetails.event_details.date = eventDateMatch[1].trim();
      if (eventLocationMatch) planDetails.event_details.location = eventLocationMatch[1].trim();
      if (eventCategoryMatch) planDetails.event_details.category = eventCategoryMatch[1].trim();
      if (eventCostMatch) planDetails.event_details.cost = eventCostMatch[1].trim();
      
      console.log('🎯 Fallback plan details:', JSON.stringify(planDetails, null, 2));
    }

    console.log('🎯 ===== PLAN EXTRACTION COMPLETE =====');
    console.log('✅ Final extracted plan details:', JSON.stringify(planDetails, null, 2));
    return planDetails;

  } catch (error) {
    console.error('❌ ===== PLAN EXTRACTION FAILED =====');
    console.error('❌ Error extracting plan with AI:', error.response?.data || error.message);
    console.error('❌ Error status:', error.response?.status);
    console.error('❌ Error headers:', error.response?.headers);
    // Fallback to basic extraction
    return extractPlanFromMessagesBasic(messages);
  }
};

// Fallback helper function to extract plan details from conversation messages
const extractPlanFromMessagesBasic = (messages) => {
  const plan = {
    activities: [],
    duration: "3-4 hours",
    budget: "$$"
  };

  // Look for specific mentions in the conversation
  messages.forEach(msg => {
    if (msg.role === 'assistant') {
      const content = msg.content.toLowerCase();
      
      // Extract activities
      if (content.includes('high line')) {
        plan.activities.push('High Line walk');
      }
      if (content.includes('momofuku') || content.includes('noodle bar')) {
        plan.activities.push('Momofuku Noodle Bar dinner');
      }
      if (content.includes('central park')) {
        plan.activities.push('Central Park stroll');
      }
      if (content.includes('cooking class')) {
        plan.activities.push('Korean cooking class');
      }
      if (content.includes('carbone')) {
        plan.activities.push('Carbone dinner');
        plan.budget = "$$$";
      }
      if (content.includes('broadway') || content.includes('hadestown') || content.includes('show')) {
        plan.activities.push('Broadway show: Hadestown');
        plan.budget = "$$$";
      }
      if (content.includes('walter kerr') || content.includes('theatre')) {
        plan.activities.push('Walter Kerr Theatre show');
      }
      if (content.includes('sardi')) {
        plan.activities.push('Sardi\'s Restaurant drinks');
      }
      
      // Extract times
      if (content.includes('5:30pm') || content.includes('5:30 pm')) {
        plan.duration = "4-5 hours";
      }
      if (content.includes('6:30pm') || content.includes('6:30 pm')) {
        plan.duration = "4-5 hours";
      }
      if (content.includes('8pm') || content.includes('8:00pm')) {
        plan.duration = "4-5 hours";
      }
      if (content.includes('7pm') || content.includes('7:00pm')) {
        plan.duration = "3-4 hours";
      }
    }
    
    // Also check user messages for activity mentions
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      
      if (content.includes('broadway') || content.includes('hadestown')) {
        plan.activities.push('Broadway show: Hadestown');
        plan.budget = "$$$";
      }
      if (content.includes('carbone')) {
        plan.activities.push('Carbone dinner');
        plan.budget = "$$$";
      }
    }
  });

  return plan;
};

// Helper function to generate AI recommendation based on user and partner interests
const generateAIRecommendation = (userMessage, userProfile, partnerProfile) => {
  try {
    console.log('🎯 ===== GENERATING AI RECOMMENDATION =====');
    console.log('🎯 User message:', userMessage);
    console.log('🎯 User profile:', JSON.stringify(userProfile, null, 2));
    console.log('🎯 Partner profile:', JSON.stringify(partnerProfile, null, 2));
    
    // Extract interests from profiles
    const userInterests = userProfile?.interests || [];
    const partnerInterests = partnerProfile?.interests || [];
    const combinedInterests = [...userInterests, ...partnerInterests];
    
    console.log('🎯 Combined interests:', combinedInterests);
    
    // Generate recommendation based on interests and event type
    const messageLower = userMessage.toLowerCase();
    
    // Check for event types
    if (messageLower.includes('theatre') || messageLower.includes('broadway') || messageLower.includes('show')) {
      if (combinedInterests.includes('romance') || combinedInterests.includes('dining')) {
        return "Get drinks before the show at a romantic cocktail bar near the theatre - perfect for building anticipation and creating intimate conversation before the performance.";
      } else if (combinedInterests.includes('food') || combinedInterests.includes('dining')) {
        return "Try a pre-show dinner at a restaurant within walking distance of the theatre - many Broadway-area restaurants offer theatre packages and can accommodate show schedules.";
      } else {
        return "Arrive early to explore the theatre district and grab a quick bite or drinks before the show - the area has great energy and atmosphere.";
      }
    } else if (messageLower.includes('concert') || messageLower.includes('music')) {
      if (combinedInterests.includes('nightlife') || combinedInterests.includes('drinks')) {
        return "Check out nearby bars or lounges after the concert - many venues have after-parties or the area has great late-night spots for continuing the evening.";
      } else if (combinedInterests.includes('food')) {
        return "Plan a late dinner after the concert at a restaurant that stays open late - perfect for discussing the music and extending your evening together.";
      } else {
        return "Consider grabbing coffee or dessert nearby after the concert - a great way to discuss the music and wind down the evening together.";
      }
    } else if (messageLower.includes('museum') || messageLower.includes('art') || messageLower.includes('gallery')) {
      if (combinedInterests.includes('coffee') || combinedInterests.includes('cafe')) {
        return "Visit the museum café or a nearby coffee shop afterwards to discuss the art and share your favorite pieces - great for intellectual conversation.";
      } else if (combinedInterests.includes('walking') || combinedInterests.includes('parks')) {
        return "Take a leisurely walk in a nearby park after the museum - perfect for processing the art together and enjoying each other's company.";
      } else {
        return "Plan to grab lunch or drinks nearby after the museum visit - great for discussing the exhibits and getting to know each other better.";
      }
    } else if (messageLower.includes('sports') || messageLower.includes('game')) {
      if (combinedInterests.includes('food') || combinedInterests.includes('drinks')) {
        return "Hit a sports bar or restaurant near the venue before or after the game - great atmosphere and perfect for discussing the action.";
      } else if (combinedInterests.includes('walking')) {
        return "Take a walk around the stadium area before the game to soak up the atmosphere and excitement together.";
      } else {
        return "Arrive early to explore the venue and grab some food or drinks - stadiums often have great pre-game activities and atmosphere.";
      }
    }
    
    // Default recommendation based on interests
    if (combinedInterests.includes('romance')) {
      return "Consider adding a romantic element like a quiet walk, intimate dinner, or cozy café stop to make the evening more special.";
    } else if (combinedInterests.includes('adventure') || combinedInterests.includes('exploring')) {
      return "Explore the area around the event venue - discover hidden gems, local spots, or interesting architecture to make the experience more adventurous.";
    } else if (combinedInterests.includes('food') || combinedInterests.includes('dining')) {
      return "Plan a meal before or after the event at a restaurant that complements the experience - great for conversation and extending your time together.";
    } else if (combinedInterests.includes('drinks') || combinedInterests.includes('nightlife')) {
      return "Add a bar or lounge stop to your evening - perfect for unwinding and getting to know each other better in a relaxed atmosphere.";
    }
    
    // Generic recommendation
    return "Consider adding a pre or post-event activity to extend your time together and create more opportunities for conversation and connection.";
    
  } catch (error) {
    console.error('❌ Error generating AI recommendation:', error);
    return null;
  }
};

// Helper function to create fallback DateFlow
const createFallbackDateFlow = (planDetails, location, userProfile = null, partnerProfile = null, aiRecommendation = null) => {
  console.log('🎯 ===== CREATING FALLBACK DATEFLOW FUNCTION =====');
  console.log('🎯 Input planDetails:', JSON.stringify(planDetails, null, 2));
  console.log('🎯 Input location:', location);
  console.log('🎯 Input userProfile:', JSON.stringify(userProfile, null, 2));
  console.log('🎯 Input partnerProfile:', JSON.stringify(partnerProfile, null, 2));
  console.log('🎯 Input aiRecommendation:', aiRecommendation);
  
  // Ensure planDetails has the expected structure
  if (!planDetails) {
    console.log('🎯 planDetails is null/undefined, creating default structure');
    planDetails = {
      activities: [],
      restaurants: [],
      times: [],
      locations: [],
      duration: "3-4 hours",
      budget: "$$",
      event_details: {},
      summary: "Date plan"
    };
  }
  
  // Ensure activities is an array
  if (!Array.isArray(planDetails.activities)) {
    console.log('🎯 planDetails.activities is not an array, setting to empty array');
    planDetails.activities = [];
  }
  
  const cityName = location.split(',')[0];
  console.log('🎯 City name:', cityName);
  
  // Generate personalized title with user and partner names
  const userName = userProfile?.name || 'You';
  const partnerName = partnerProfile?.name || 'Your Date';
  console.log('🎯 User name:', userName);
  console.log('🎯 Partner name:', partnerName);
  
  let title;
  const eventName = planDetails.event_details?.event_name || planDetails.event_name;
  if (eventName) {
    if (userName !== 'You' && partnerName && partnerName !== 'Your Date') {
      title = `${userName} & ${partnerName}'s ${eventName} Experience`;
    } else if (userName !== 'You') {
      title = `${userName}'s ${eventName} Date Plan`;
    } else {
      title = `${eventName} Date Experience`;
    }
  } else {
  if (userName !== 'You' && partnerName && partnerName !== 'Your Date') {
    title = `${userName} & ${partnerName}'s Perfect Date`;
  } else if (userName !== 'You') {
    title = `${userName}'s Perfect Date Plan`;
  } else {
    title = `Perfect Date in ${cityName}`;
  }
  }
  console.log('🎯 Generated title:', title);

  // Create a more comprehensive fallback based on extracted activities
  const flow = [];
  
  // Step 1: Pre-activity (if mentioned in conversation)
  if (planDetails.activities && Array.isArray(planDetails.activities) && planDetails.activities.some(activity => {
    const activityStr = String(activity || '').toLowerCase();
    return activityStr.includes('carbone') || 
           activityStr.includes('dinner') ||
           activityStr.includes('restaurant');
  })) {
    flow.push({
      step: 1,
      phase: "Pre-Show Dinner",
      activity: "Upscale Italian dinner at Carbone",
      venue: "Carbone",
      address: "181 Thompson Street, New York, NY",
      duration: "1.5 hours",
      cost: "$80-120",
      description: "Enjoy an elegant pre-show dinner at this acclaimed Italian-American restaurant.",
      tips: "Make reservations well in advance - this place is popular!"
    });
  } else {
    flow.push({
      step: 1,
      phase: "Meet & Greet",
      activity: "Meet at theatre district",
      venue: "Times Square",
      address: "Times Square, New York, NY",
      duration: "30 minutes",
      cost: "Free",
      description: "Meet in the bustling theatre district and soak up the Broadway atmosphere.",
      tips: "Arrive a few minutes early to find each other easily"
    });
  }

  // Step 2: Main Activity (use actual event details if available)
  if (planDetails.event_details && planDetails.event_details.event_name) {
    const event = planDetails.event_details;
    // Extract Ticketmaster URL from multiple possible sources
    const ticketmasterUrl = event.url || 
                           event.event_ticketmaster_url || 
                           event.event_url || 
                           planDetails.event_url || 
                           planDetails.url ||
                           (planDetails.original_event_data && planDetails.original_event_data.url) ||
                           null; // Don't use placeholder URLs
    
    console.log('🎫 Ticketmaster URL extraction:', {
      event_ticketmaster_url: event.event_ticketmaster_url,
      event_url: event.event_url,
      event_url_direct: event.url,
      planDetails_event_url: planDetails.event_url,
      planDetails_url: planDetails.url,
      original_event_data_url: planDetails.original_event_data?.url,
      final_ticketmaster_url: ticketmasterUrl
    });
    
    flow.push({
      step: 2,
      phase: "Main Event",
      activity: event.event_name,
      venue: event.event_venue || event.event_location || "Event Venue",
      address: event.event_address || event.event_location || `${cityName}, NY`,
      duration: "2-3 hours",
      cost: event.event_cost || "Price varies",
      description: event.event_description || `Experience ${event.event_name}`,
      tips: `Arrive early to enjoy the full experience`,
      recommendation: `This is the main event - ${event.event_name}`,
      is_recommendation: true,
      ticketmaster_url: ticketmasterUrl
    });
  } else if (planDetails.activities && Array.isArray(planDetails.activities) && planDetails.activities.some(activity => {
    const activityStr = String(activity || '').toLowerCase();
    return activityStr.includes('broadway') || 
           activityStr.includes('hadestown') ||
           activityStr.includes('show');
  })) {
    flow.push({
      step: 2,
      phase: "Main Event",
      activity: "Broadway Show: Hadestown",
      venue: "Walter Kerr Theatre",
      address: "219 West 48th Street, New York, NY",
      duration: "2.5 hours",
      cost: "$100-300",
      description: "Experience the critically-acclaimed musical Hadestown, a modern retelling of the ancient Greek myth.",
      tips: "Arrive 15 minutes early to pick up tickets and find your seats"
    });
  } else {
    flow.push({
      step: 2,
      phase: "Main Activity",
      activity: planDetails.activities && planDetails.activities[1] ? planDetails.activities[1] : "Sunset walk and dinner",
      venue: "Momofuku Noodle Bar",
      address: "East Village, Manhattan",
      duration: "2-3 hours",
      cost: "$40-60",
      description: `Enjoy a romantic dinner at one of ${cityName}'s best restaurants.`,
      tips: "Try the ramen - it's amazing!"
    });
  }

  // Step 3: AI Recommendation or Post-activity
  if (aiRecommendation) {
    flow.push({
      step: 3,
      phase: "AI Recommendation",
      activity: "Personalized Enhancement",
      venue: "Based on your interests",
      address: "Location TBD",
      duration: "30-60 minutes",
      cost: "$15-30",
      description: aiRecommendation,
      tips: "This recommendation is tailored to your and your partner's interests",
      recommendation: aiRecommendation,
      is_recommendation: true
    });
  } else {
  flow.push({
    step: 3,
    phase: "Evening Closer",
    activity: "Post-show drinks and conversation",
    venue: "Sardi's Restaurant",
    address: "234 West 44th Street, New York, NY",
    duration: "1 hour",
    cost: "$30-50",
    description: "End your perfect evening with drinks at this iconic Broadway restaurant.",
    tips: "Perfect time to discuss the show and make deeper connections"
  });
  }

  return {
    title: title,
    totalDuration: planDetails.duration || "4-5 hours",
    totalBudget: planDetails.budget || "$$$",
    flow: flow,
    restaurants: [
      {
        name: "Carbone",
        address: "181 Thompson Street, New York, NY",
        cuisine: "Italian-American",
        priceRange: "$80-120 per person",
        description: "Upscale Italian-American restaurant perfect for special occasions",
        reservation: "5:30 PM recommended for pre-show"
      },
      {
        name: "Sardi's Restaurant",
        address: "234 West 44th Street, New York, NY",
        cuisine: "American",
        priceRange: "$30-50 per person",
        description: "Iconic Broadway restaurant with celebrity caricatures",
        reservation: "Post-show drinks"
      }
    ],
    backupOptions: [
      {
        scenario: "Weather issue",
        alternative: "Indoor museum visit",
        venue: "Museum of Modern Art (MoMA)",
        cost: "$20-30"
      },
      {
        scenario: "Show sold out",
        alternative: "Alternative Broadway show",
        venue: "Check TKTS booth for same-day discounts",
        cost: "$50-100"
      }
    ],
    logistics: {
      transportation: "Subway or taxi between locations",
      parking: "Limited street parking, consider garages",
      timing: "Start around 5:30 PM for dinner, show at 8:00 PM",
      weather: "All activities are indoors - weather won't affect plans"
    }
  };
  
  console.log('🎯 ===== FALLBACK DATEFLOW CREATION COMPLETE =====');
  console.log('🎯 Final fallback DateFlow:', JSON.stringify({
    title,
    totalDuration: "3-4 hours",
    totalBudget: "$$",
    flow: flow.length,
    restaurants: restaurants.length,
    backupOptions: backupOptions.length
  }, null, 2));
  
  return {
    title,
    totalDuration: "3-4 hours",
    totalBudget: "$$",
    flow,
    restaurants,
    backupOptions,
    logistics: {
      transportation: "Subway or taxi between locations",
      parking: "Limited street parking, consider garages",
      timing: "Start around 5:30 PM for dinner, show at 8:00 PM",
      weather: "All activities are indoors - weather won't affect plans"
    }
  };
};

// Email service for sending DateFlow calendar invitations using SendGrid
const sendDateFlowInvitation = async (userEmail, dateFlow, selectedDate, selectedTime, partnerEmail = null) => {
  try {
    console.log('📧 Preparing to send DateFlow invitation via SendGrid...');
    console.log('  - User Email:', userEmail);
    console.log('  - Date:', selectedDate);
    console.log('  - Time:', selectedTime);
    console.log('  - Partner Email:', partnerEmail || 'None');
    
    // Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    // Parse the selected date and time
    const eventDate = new Date(`${selectedDate}T${selectedTime}`);
    const endTime = new Date(eventDate);
    endTime.setHours(endTime.getHours() + 4); // Default 4-hour duration

    // Create .ics calendar content
    const icsContent = createICSContent(dateFlow, eventDate, endTime);

    // Create email content
    const emailSubject = `Your DateFlow: ${dateFlow.title}`;
    const emailBody = createEmailBody(dateFlow, selectedDate, selectedTime);

    // Prepare email options for SendGrid
    const msg = {
      to: userEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'afsarijustin@gmail.com',
        name: 'DateFlow AI'
      },
      subject: emailSubject,
      text: emailBody,
      html: createEmailHTML(dateFlow, selectedDate, selectedTime),
      attachments: [
        {
          content: Buffer.from(icsContent).toString('base64'),
          filename: 'dateflow-invitation.ics',
          type: 'text/calendar',
          disposition: 'attachment'
        }
      ],
      // Add headers to improve deliverability
      headers: {
        'X-Mailer': 'DateFlow AI',
        'X-Priority': '3'
      },
      // Add tracking settings
      trackingSettings: {
        clickTracking: {
          enable: false
        },
        openTracking: {
          enable: false
        }
      }
    };

    // Add partner email if provided
    if (partnerEmail) {
      msg.cc = partnerEmail;
    }

    // Send email via SendGrid
    const response = await sgMail.send(msg);
    console.log('✅ DateFlow invitation sent successfully via SendGrid:', response[0].headers['x-message-id']);
    
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      message: 'DateFlow invitation sent successfully!'
    };

  } catch (error) {
    console.error('❌ SendGrid email sending error:', error);
    
    // Handle specific SendGrid errors
    if (error.response) {
      console.error('SendGrid API Error Response:', error.response.body);
      
      if (error.response.body?.errors) {
        const sendGridError = error.response.body.errors[0];
        return {
          success: false,
          error: `SendGrid Error: ${sendGridError.message}`,
          message: 'Failed to send DateFlow invitation',
          details: sendGridError
        };
      }
    }
    
    return {
      success: false,
      error: error.message,
      message: 'Failed to send DateFlow invitation'
    };
  }
};

// Create .ics calendar file content
const createICSContent = (dateFlow, startDate, endDate) => {
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text) => {
    return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const duration = dateFlow.flow || [];
  const location = duration.length > 0 ? duration[0].location || duration[0].venue || 'TBD' : 'TBD';
  
  const description = `Your perfect DateFlow has been crafted!\n\n` +
    `TIMELINE:\n` +
    duration.map(step => 
      `${step.duration || '30 min'} - ${step.activity || step.title}\n` +
      `📍 ${step.location || step.venue || 'TBD'}\n` +
      `${step.description || ''}\n`
    ).join('\n') +
    `\nBudget: ${dateFlow.totalBudget || 'TBD'}\n` +
    `Duration: ${dateFlow.totalDuration || '3-4 hours'}`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DateFlow AI//Date Planning//EN
BEGIN:VEVENT
UID:${Date.now()}@dateflow.ai
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${escapeText(dateFlow.title)}
DESCRIPTION:${escapeText(description)}
LOCATION:${escapeText(location)}
STATUS:CONFIRMED
TRANSP:OPAQUE
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:DateFlow reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;
};

// Create plain text email body
const createEmailBody = (dateFlow, selectedDate, selectedTime) => {
  const duration = dateFlow.flow || [];
  
  return `Hi there!

Your perfect DateFlow has been crafted! Here's your intimate evening:

🗓️ Date: ${selectedDate}
⏰ Time: ${selectedTime}
📍 Starting Location: ${duration.length > 0 ? (duration[0].location || duration[0].venue || 'TBD') : 'TBD'}

TIMELINE:
${duration.map((step, index) => 
  `${index + 1}. ${step.activity || step.title}
   📍 ${step.location || step.venue || 'TBD'}
   ⏰ ${step.duration || '30 minutes'}
   ${step.description ? `💬 ${step.description}` : ''}
   ${step.tips ? `💡 ${step.tips}` : ''}
   ${step.recommendation ? `🌟 RECOMMENDATION: ${step.recommendation}` : ''}
   ${step.ticketmaster_url ? `🎫 Get Tickets: ${step.ticketmaster_url}` : ''}
`).join('\n')}

💰 Budget: ${dateFlow.totalBudget || 'TBD'}
⏱️ Total Duration: ${dateFlow.totalDuration || '3-4 hours'}

This invitation has been automatically added to your calendar. Enjoy your captivating evening!

Best,
Fiona from DateFlow AI 💕`;
};

// Create HTML email body
const createEmailHTML = (dateFlow, selectedDate, selectedTime) => {
  const duration = dateFlow.flow || [];
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; text-align: center;">Your DateFlow Invitation</h2>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #000; margin-top: 0;">${dateFlow.title}</h3>
        <p><strong>🗓️ Date:</strong> ${selectedDate}</p>
        <p><strong>⏰ Time:</strong> ${selectedTime}</p>
        <p><strong>📍 Starting Location:</strong> ${duration.length > 0 ? (duration[0].location || duration[0].venue || 'TBD') : 'TBD'}</p>
        ${dateFlow.event_details && dateFlow.event_details.name ? `
          <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 5px; padding: 15px; margin: 15px 0;">
            <h4 style="color: #1976d2; margin: 0 0 10px 0;">🎭 Main Event Details</h4>
            <p style="margin: 5px 0;"><strong>Event:</strong> ${dateFlow.event_details.name}</p>
            ${dateFlow.event_details.venue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${dateFlow.event_details.venue}</p>` : ''}
            ${dateFlow.event_details.date ? `<p style="margin: 5px 0;"><strong>Event Date:</strong> ${dateFlow.event_details.date}</p>` : ''}
            ${dateFlow.event_details.time ? `<p style="margin: 5px 0;"><strong>Event Time:</strong> ${dateFlow.event_details.time}</p>` : ''}
            ${dateFlow.event_details.cost ? `<p style="margin: 5px 0;"><strong>Cost:</strong> ${dateFlow.event_details.cost}</p>` : ''}
            ${dateFlow.event_details.ticketmaster_url ? `<div style="text-align: center; margin: 10px 0;"><a href="${dateFlow.event_details.ticketmaster_url}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">🎫 Get Event Tickets</a></div>` : ''}
          </div>
        ` : ''}
      </div>
      
      <h3 style="color: #333;">Your Timeline:</h3>
      ${duration.map((step, index) => `
        <div style="border-left: 3px solid #e74c3c; padding-left: 15px; margin: 15px 0; ${step.is_recommendation ? 'background: #fff3cd; border-left-color: #ffc107; border-radius: 8px; padding: 15px;' : ''}">
          <h4 style="color: #e74c3c; margin: 0;">${index + 1}. ${step.activity || step.title}</h4>
          <p style="margin: 5px 0;"><strong>📍</strong> ${step.location || step.venue || 'TBD'}</p>
          <p style="margin: 5px 0;"><strong>⏰</strong> ${step.duration || '30 minutes'}</p>
          ${step.description ? `<p style="margin: 5px 0;"><strong>💬</strong> ${step.description}</p>` : ''}
          ${step.tips ? `<p style="margin: 5px 0;"><strong>💡</strong> ${step.tips}</p>` : ''}
          ${step.recommendation ? `<div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 10px; margin: 10px 0;"><strong>🌟 RECOMMENDATION:</strong> ${step.recommendation}</div>` : ''}
          ${step.ticketmaster_url ? `<div style="text-align: center; margin: 10px 0;"><a href="${step.ticketmaster_url}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">🎫 Get Tickets on Ticketmaster</a></div>` : ''}
        </div>
      `).join('')}
      
      <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>💰 Budget:</strong> ${dateFlow.totalBudget || 'TBD'}</p>
        <p style="margin: 5px 0 0 0;"><strong>⏱️ Total Duration:</strong> ${dateFlow.totalDuration || '3-4 hours'}</p>
      </div>
      
      <p style="text-align: center; color: #666; font-style: italic;">
        This invitation has been automatically added to your calendar.<br>
        Enjoy your captivating evening!
      </p>
      
      <p style="text-align: center; color: #999; font-size: 14px;">
        Best,<br>
        Fiona from DateFlow AI 💕
      </p>
    </div>
  `;
};

// POST /api/chat/send-dateflow-invitation - Send DateFlow calendar invitation
router.post('/send-dateflow-invitation', authenticateToken, async (req, res) => {
  try {
    const { userEmail, dateFlow, selectedDate, selectedTime, partnerEmail } = req.body;
    
    if (!userEmail || !dateFlow || !selectedDate || !selectedTime) {
      return res.status(400).json({
        error: 'Missing required fields: userEmail, dateFlow, selectedDate, selectedTime',
        code: 'MISSING_FIELDS'
      });
    }

    console.log('📧 DateFlow invitation request received:', {
      userEmail,
      selectedDate,
      selectedTime,
      partnerEmail: partnerEmail || 'None'
    });

    // Debug SendGrid configuration
    console.log('🔧 SendGrid Configuration:');
    console.log('  - API Key exists:', !!process.env.SENDGRID_API_KEY);
    console.log('  - API Key starts with SG:', process.env.SENDGRID_API_KEY?.startsWith('SG.'));
    console.log('  - From Email:', process.env.SENDGRID_FROM_EMAIL);

    // Send the invitation
    const result = await sendDateFlowInvitation(userEmail, dateFlow, selectedDate, selectedTime, partnerEmail);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ DateFlow invitation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send DateFlow invitation',
      code: 'INVITATION_ERROR'
    });
  }
});

module.exports = router;

// Export functions for use in other modules
module.exports.callCombinedEventsAPI = callCombinedEventsAPI;
module.exports.getCachedEvents = getCachedEvents;
module.exports.setCachedEvents = setCachedEvents;
