const axios = require('axios');

const BASE_URL = 'http://localhost:5001';
const EMAIL = 'afsarijustin@gmail.com';
const PASSWORD = 'Loserhihi1!';

async function testChatTab() {
  try {
    console.log('🧪 Testing Chat Tab Functionality');
    console.log('=====================================');

    // Step 1: Login
    console.log('\n1. 🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log(`📝 Token: ${token.substring(0, 20)}...`);

    // Step 2: Test chat endpoint with multiple utterances
    const testMessages = [
      "Hello, can you help me plan a date?",
      "I want to plan a romantic dinner date in New York",
      "What are some good date ideas for this weekend?",
      "I'm looking for something fun and adventurous"
    ];

    console.log('\n2. 💬 Testing chat responses...');
    
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`\n--- Test ${i + 1}: "${message}" ---`);
      
      try {
        const chatResponse = await axios.post(`${BASE_URL}/chat`, {
          message: message,
          session_id: `test-session-${Date.now()}`,
          partner_profile: JSON.stringify({
            name: "Sarah",
            interests: ["art", "music", "food"],
            budget: "$$",
            dietaryRestrictions: "vegetarian"
          })
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('✅ Response received:');
        console.log(`📝 AI Response: "${chatResponse.data.response}"`);
        console.log(`📊 Message Count: ${chatResponse.data.message_count}`);
        
        // Check if response is from Groq or fallback
        if (chatResponse.data.response.includes("I'm Fiona")) {
          console.log('⚠️  Using fallback response (not Groq AI)');
        } else {
          console.log('✅ Using Groq AI response');
        }

      } catch (error) {
        console.log('❌ Chat request failed:');
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Error: ${error.response?.data?.error || error.message}`);
      }

      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 3: Test events endpoint
    console.log('\n3. 🎫 Testing events endpoint...');
    try {
      const eventsResponse = await axios.get(`${BASE_URL}/chat/events?location=New York, NY&neighborhood=SoHo&radius=3`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('✅ Events loaded:');
      console.log(`📊 Event Count: ${eventsResponse.data.events?.length || 0}`);
      console.log(`📍 Location: ${eventsResponse.data.location}`);
      console.log(`🔄 Source: ${eventsResponse.data.source}`);

    } catch (error) {
      console.log('❌ Events request failed:');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }

    console.log('\n🎉 Chat Tab Testing Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testChatTab();