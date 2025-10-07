// Test Partner API endpoints
const API_BASE = 'http://localhost:5001/api';

async function testPartnerAPI() {
  console.log('🧪 Testing Partner API\n');
  
  // Step 1: Login to get token
  console.log('1️⃣  Logging in...');
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'afsarijustin@gmail.com',
      password: 'Loserhihi1!'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('❌ Login failed:', loginResponse.status);
    return;
  }
  
  const { token } = await loginResponse.json();
  console.log('✅ Login successful\n');
  
  // Step 2: Create a partner profile
  console.log('2️⃣  Creating partner profile...');
  const createResponse = await fetch(`${API_BASE}/partner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Christine',
      age: 28,
      location: 'New York, NY',
      bio: 'Loves electronic music and nightlife',
      interests: ['music', 'dancing', 'fitness', 'art'],
      preferences: {
        cuisine_preferences: ['italian', 'japanese', 'mexican'],
        activity_preferences: ['concerts', 'restaurants', 'bars', 'live_music'],
        budget_preferences: '$$'
      }
    })
  });
  
  if (!createResponse.ok) {
    console.error('❌ Create partner failed:', createResponse.status, await createResponse.text());
    return;
  }
  
  const { partner } = await createResponse.json();
  console.log('✅ Partner profile created:', {
    id: partner._id,
    name: partner.name,
    interests: partner.interests
  });
  console.log('\n');
  
  // Step 3: Get partner profile
  console.log('3️⃣  Fetching partner profile...');
  const getResponse = await fetch(`${API_BASE}/partner`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!getResponse.ok) {
    console.error('❌ Get partner failed:', getResponse.status);
    return;
  }
  
  const { partner: fetchedPartner } = await getResponse.json();
  console.log('✅ Partner profile fetched:', {
    name: fetchedPartner.name,
    interests: fetchedPartner.interests,
    age: fetchedPartner.age
  });
  console.log('\n');
  
  // Step 4: Test chat endpoint with combined interests
  console.log('4️⃣  Testing chat endpoint with combined interests...');
  const sessionId = `test-${Date.now()}`;
  const chatResponse = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'What activities would be perfect for us?',
      session_id: sessionId
    })
  });
  
  if (!chatResponse.ok) {
    console.error('❌ Chat failed:', chatResponse.status);
    return;
  }
  
  const chatData = await chatResponse.json();
  console.log('✅ Chat response received');
  console.log('📝 AI Response:', chatData.reply?.substring(0, 200) + '...\n');
  
  console.log('🎉 All tests passed! Check your backend logs for combined interests output.');
}

// Run the test
testPartnerAPI().catch(error => {
  console.error('💥 Test failed:', error);
});

