#!/usr/bin/env node

// Test Combined Interests
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5001/api';

async function testCombinedInterests() {
  console.log('🎯 Testing Combined Interests\n');
  
  // Step 1: Login
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
  
  // Step 2: Get user profile
  console.log('2️⃣  Getting user profile...');
  const userResponse = await fetch(`${API_BASE}/user/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (userResponse.ok) {
    const userData = await userResponse.json();
    console.log('👤 User interests:', userData.user.profile.interests);
  }
  
  // Step 3: Get partner profile
  console.log('3️⃣  Getting partner profile...');
  const partnerResponse = await fetch(`${API_BASE}/partner`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (partnerResponse.ok) {
    const partnerData = await partnerResponse.json();
    console.log('💕 Partner interests:', partnerData.partner.interests);
  } else {
    console.log('❌ No partner profile found');
  }
  
  // Step 4: Test chat with combined interests
  console.log('4️⃣  Testing chat (check backend logs for combined interests)...');
  const chatResponse = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'What activities would be perfect for us?',
      session_id: `test-${Date.now()}`
    })
  });
  
  if (chatResponse.ok) {
    const chatData = await chatResponse.json();
    console.log('✅ Chat response received');
    console.log('🤖 AI Response:', chatData.response);
    console.log('\n💡 Check your backend console for the combined interests debug logs!');
    console.log('   Look for: 🎯 ========== INTERESTS DEBUG ==========');
  } else {
    console.error('❌ Chat failed:', chatResponse.status);
  }
}

testCombinedInterests().catch(console.error);
