// Mock API for guest chat - will be replaced with real backend
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, session_id } = req.body;

  if (!message || !session_id) {
    return res.status(400).json({
      error: 'Message and session_id are required',
      code: 'MISSING_FIELDS'
    });
  }

  // Simple mock responses based on keywords
  let aiResponse;
  const msg = message.toLowerCase();

  if (msg.includes('dinner') || msg.includes('restaurant')) {
    aiResponse = "Perfect! For a dinner date, consider the atmosphere and cuisine type. What kind of food do you both enjoy? Are you looking for something romantic, casual, or somewhere in between?";
  } else if (msg.includes('first date')) {
    aiResponse = "Great! For a first date, I'd recommend keeping it simple and comfortable. Coffee shops or casual lunch spots work perfectly. What's your budget range and how much time do you have available?";
  } else if (msg.includes('italian') && msg.includes('dinner')) {
    aiResponse = "Italian food is perfect for a romantic dinner! I'd suggest looking for a cozy trattoria with dim lighting. Would you prefer a traditional family-style place or something more modern?";
  } else if (msg.includes('tokyo') || msg.includes('japan')) {
    aiResponse = "Tokyo is amazing for dates! Consider a traditional tea ceremony, exploring Tsukiji Outer Market for fresh sushi, or a romantic walk through Shinjuku Gyoen National Garden. What type of experience are you both interested in?";
  } else if (msg.includes('traveling')) {
    aiResponse = "Travel dates are so special! Are you thinking domestic or international? I can suggest romantic destinations, unique experiences, and tips for planning the perfect getaway together.";
  } else {
    aiResponse = "I'm here to help you plan the perfect date! Tell me about your situation - what type of date are you planning, who you're going with, and what you're hoping to do. The more details you share, the better I can help!";
  }

  res.json({
    message: aiResponse,
    session_id: session_id,
    is_guest: true,
    suggestion: 'Create an account to save your conversations and get personalized dating advice!'
  });
}
