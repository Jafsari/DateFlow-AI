const fetch = require('node-fetch');

async function checkPartnerDatabase() {
  try {
    console.log('🔍 Checking partner profile in database...');
    
    // Login
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'afsarijustin@gmail.com',
        password: 'Loserhihi1!'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed');
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');
    
    // Check what's in the database
    const getResponse = await fetch('http://localhost:5001/api/partner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('📡 Get response status:', getResponse.status);
    
    if (getResponse.ok) {
      const result = await getResponse.json();
      console.log('✅ Partner profile found in database:');
      console.log('  Name:', result.partner.name);
      console.log('  Age:', result.partner.age);
      console.log('  Location:', result.partner.location);
      console.log('  Interests:', result.partner.interests);
      console.log('  Created:', result.partner.created_at);
      console.log('  Updated:', result.partner.updated_at);
    } else if (getResponse.status === 404) {
      console.log('❌ No partner profile found in database (404)');
    } else {
      const error = await getResponse.text();
      console.error('❌ Error getting partner profile:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPartnerDatabase();
