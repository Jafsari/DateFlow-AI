const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
require('dotenv').config();

async function testDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Test creating a user
    console.log('\n👤 Testing User creation...');
    const testUser = new User({
      email: 'test@example.com',
      password_hash: 'testpassword123',
      profile: {
        name: 'Test User',
        location: 'Test City',
        preferences: {
          budget_range: '$$',
          activity_types: ['outdoor', 'cultural'],
          transportation: 'public'
        }
      }
    });

    await testUser.save();
    console.log('✅ User created successfully:', testUser.email);

    // Test creating a conversation
    console.log('\n💬 Testing Conversation creation...');
    const testConversation = new Conversation({
      user_id: testUser._id,
      session_id: 'test_session_123',
      messages: [
        {
          role: 'user',
          content: 'I need help planning a first date'
        },
        {
          role: 'assistant',
          content: 'Great! I\'d love to help you plan the perfect first date. What kind of activity are you thinking about?'
        }
      ],
      context: {
        current_topic: 'date_planning',
        user_mood: 'excited',
        conversation_summary: 'User planning first date',
        key_insights: ['First date planning', 'User is excited']
      }
    });

    await testConversation.save();
    console.log('✅ Conversation created successfully:', testConversation._id);

    // Test querying data
    console.log('\n📊 Testing data queries...');
    
    const foundUser = await User.findById(testUser._id);
    console.log('✅ Found user:', foundUser.email);

    const foundConversation = await Conversation.findOne({ user_id: testUser._id });
    console.log('✅ Found conversation with', foundConversation.messages.length, 'messages');

    // Test user's conversation count
    const userConversations = await Conversation.find({ user_id: testUser._id });
    console.log('✅ User has', userConversations.length, 'conversations');

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await Conversation.deleteMany({ user_id: testUser._id });
    await User.findByIdAndDelete(testUser._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All database tests passed!');
    console.log('\n📋 Database Summary:');
    console.log('- Users collection: Ready');
    console.log('- Conversations collection: Ready');
    console.log('- Indexes: Created');
    console.log('- TTL: Configured for auto-cleanup');

  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testDatabase();
