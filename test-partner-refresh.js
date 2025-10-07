const fetch = require('node-fetch');

async function testPartnerRefresh() {
  try {
    console.log('🧪 Testing partner profile persistence after refresh...');
    
    // Step 1: Login
    console.log('🔐 Step 1: Logging in...');
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    console.log('✅ Login successful');
    
    // Step 2: Create/Update partner profile
    console.log('💾 Step 2: Creating partner profile...');
    const partnerData = {
      name: 'Refresh Test Partner',
      age: 28,
      location: 'Refresh City',
      bio: 'Testing persistence after refresh',
      interests: ['music', 'art', 'travel'],
      keywords: 'persistent, test',
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
    
    if (!saveResponse.ok) {
      console.error('❌ Save failed:', await saveResponse.text());
      return;
    }
    
    const saveResult = await saveResponse.json();
    console.log('✅ Partner profile saved:', saveResult.partner.name);
    
    // Step 3: Simulate page refresh - get partner profile
    console.log('🔄 Step 3: Simulating page refresh - loading partner profile...');
    const getResponse = await fetch('http://localhost:5001/api/partner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (getResponse.ok) {
      const getResult = await getResponse.json();
      console.log('✅ Partner profile loaded after refresh:', {
        name: getResult.partner.name,
        age: getResult.partner.age,
        location: getResult.partner.location,
        interests: getResult.partner.interests
      });
      
      // Verify the data matches what we saved
      if (getResult.partner.name === partnerData.name) {
        console.log('🎉 SUCCESS: Partner profile persists after refresh!');
      } else {
        console.log('❌ FAILURE: Partner profile data does not match');
      }
    } else {
      console.error('❌ Failed to load partner profile after refresh:', await getResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testPartnerRefresh();
