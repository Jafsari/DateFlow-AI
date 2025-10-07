const fetch = require('node-fetch');

async function testSaveAndCheck() {
  try {
    console.log('🧪 Testing save and immediate check...');
    
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
    
    // Create partner profile
    console.log('💾 Creating partner profile...');
    const partnerData = {
      name: 'Test Save Partner',
      age: 30,
      location: 'Test City',
      bio: 'Testing save and check',
      interests: ['music', 'art'],
      keywords: 'test, save',
      dietaryRestrictions: 'none',
      budget: 'moderate'
    };
    
    const saveResponse = await fetch('http://localhost:5001/api/partner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(partnerData)
    });
    
    console.log('📡 Save response status:', saveResponse.status);
    
    if (saveResponse.ok) {
      const saveResult = await saveResponse.json();
      console.log('✅ Partner profile saved:', saveResult.partner.name);
      
      // Immediately check if it's in the database
      console.log('🔍 Immediately checking database...');
      const getResponse = await fetch('http://localhost:5001/api/partner', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('📡 Get response status:', getResponse.status);
      
      if (getResponse.ok) {
        const getResult = await getResponse.json();
        console.log('✅ Partner profile found in database:', getResult.partner.name);
      } else {
        const error = await getResponse.text();
        console.error('❌ Partner profile not found after save:', error);
      }
    } else {
      const error = await saveResponse.text();
      console.error('❌ Save failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSaveAndCheck();
