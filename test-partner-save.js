const fetch = require('node-fetch');

async function testPartnerSave() {
  try {
    console.log('🧪 Testing partner profile save...');
    
    // First, let's login to get a token
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'afsarijustin@gmail.com',
        password: 'Loserhihi1!'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');
    
    // Test partner profile creation
    const partnerData = {
      name: 'Test Partner',
      age: 25,
      location: 'Test City',
      bio: 'Test bio',
      interests: ['music', 'art', 'travel'],
      keywords: 'creative, adventurous',
      dietaryRestrictions: 'vegetarian',
      budget: 'moderate'
    };
    
    console.log('📤 Sending partner data:', partnerData);
    
    const partnerResponse = await fetch('http://localhost:5001/api/partner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(partnerData)
    });
    
    console.log('📡 Partner response status:', partnerResponse.status);
    
    if (partnerResponse.ok) {
      const partnerResult = await partnerResponse.json();
      console.log('✅ Partner profile created successfully:', partnerResult);
    } else {
      const errorText = await partnerResponse.text();
      console.error('❌ Partner creation failed:', errorText);
    }
    
    // Test getting the partner profile
    const getResponse = await fetch('http://localhost:5001/api/partner', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📡 Get partner response status:', getResponse.status);
    
    if (getResponse.ok) {
      const getResult = await getResponse.json();
      console.log('✅ Partner profile retrieved:', getResult);
    } else {
      const errorText = await getResponse.text();
      console.error('❌ Get partner failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testPartnerSave();
