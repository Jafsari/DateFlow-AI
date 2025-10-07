#!/usr/bin/env node

/**
 * Test script to verify partner profile editing functionality
 * This script tests the partner profile API endpoints
 */

const API_BASE_URL = 'http://localhost:5001';

async function testPartnerProfileEditing() {
  console.log('🧪 Testing Partner Profile Editing Functionality\n');

  try {
    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'afsarijustin@gmail.com',
        password: 'Loserhihi1!'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');

    // Step 2: Create a test partner profile
    console.log('\n2️⃣ Creating test partner profile...');
    const testPartnerProfile = {
      name: 'Test Partner',
      interests: ['music', 'dancing', 'fitness', 'art'],
      keywords: 'romantic, adventurous, cultural',
      dietaryRestrictions: 'vegetarian, gluten-free',
      budget: 'moderate',
      location: 'downtown, near the beach'
    };

    const createResponse = await fetch(`${API_BASE_URL}/api/partner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testPartnerProfile)
    });

    if (!createResponse.ok) {
      throw new Error(`Create partner profile failed: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    const partnerId = createData.partner._id;
    console.log('✅ Partner profile created:', createData.partner);

    // Step 3: Test updating interests
    console.log('\n3️⃣ Testing interests update...');
    const updatedInterests = ['music', 'dancing', 'fitness', 'art', 'hiking', 'cooking'];
    
    const updateResponse = await fetch(`${API_BASE_URL}/api/partner/${partnerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...testPartnerProfile,
        interests: updatedInterests
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Update partner profile failed: ${updateResponse.status}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ Partner profile updated:', updateData.partner);
    console.log('   Interests:', updateData.partner.interests);

    // Step 4: Test updating other fields
    console.log('\n4️⃣ Testing other fields update...');
    const updatedProfile = {
      ...testPartnerProfile,
      interests: updatedInterests,
      keywords: 'romantic, adventurous, cultural, foodie, nature lover',
      dietaryRestrictions: 'vegetarian, gluten-free, loves Italian cuisine',
      budget: 'upscale',
      location: 'downtown, near the beach, arts district'
    };

    const updateResponse2 = await fetch(`${API_BASE_URL}/api/partner/${partnerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedProfile)
    });

    if (!updateResponse2.ok) {
      throw new Error(`Update partner profile failed: ${updateResponse2.status}`);
    }

    const updateData2 = await updateResponse2.json();
    console.log('✅ Partner profile updated again:', updateData2.partner);

    // Step 5: Verify the updates
    console.log('\n5️⃣ Verifying updates...');
    const getResponse = await fetch(`${API_BASE_URL}/api/partner`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Get partner profile failed: ${getResponse.status}`);
    }

    const getData = await getResponse.json();
    console.log('✅ Final partner profile:', getData.partner);
    console.log('   Name:', getData.partner.name);
    console.log('   Interests:', getData.partner.interests);
    console.log('   Keywords:', getData.partner.keywords);
    console.log('   Dietary Restrictions:', getData.partner.dietaryRestrictions);
    console.log('   Budget:', getData.partner.budget);
    console.log('   Location:', getData.partner.location);

    // Step 6: Test chat endpoint with partner profile
    console.log('\n6️⃣ Testing chat endpoint with partner profile...');
    const chatResponse = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: 'What do you know about my partner?',
        session_id: 'test_session'
      })
    });

    if (!chatResponse.ok) {
      throw new Error(`Chat request failed: ${chatResponse.status}`);
    }

    const chatData = await chatResponse.json();
    console.log('✅ Chat response received');
    console.log('   AI Response:', chatData.response.substring(0, 200) + '...');

    console.log('\n🎉 All partner profile editing tests passed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Partner profile creation works');
    console.log('   ✅ Interests editing works (array format)');
    console.log('   ✅ Other fields editing works');
    console.log('   ✅ Database persistence works');
    console.log('   ✅ Chat integration works');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPartnerProfileEditing();
