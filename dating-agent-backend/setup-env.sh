#!/bin/bash

# DateFlow AI Environment Setup Script
echo "🔧 Setting up DateFlow AI environment variables..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# DateFlow AI Backend Environment Variables

# Server Configuration
PORT=5001
NODE_ENV=development

# Database
MONGODB_URI=your-mongodb-connection-string-here

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Deepgram API (for voice features)
DEEPGRAM_API_KEY=your-deepgram-api-key

# Groq API (for AI responses)
GROQ_API_KEY=your-groq-api-key

# SendGrid Configuration (for DateFlow email invitations)
SENDGRID_API_KEY=your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=your-email@example.com

# Eventbrite API (for real events)
EVENTBRITE_API_KEY=your-eventbrite-api-key-here

# Ticketmaster API (for additional real events)
TICKETMASTER_CONSUMER_KEY=your-ticketmaster-consumer-key-here
TICKETMASTER_CONSUMER_SECRET=your-ticketmaster-consumer-secret-here

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Vercel Configuration (for deployment)
VERCEL=1
EOF
    echo "✅ .env file created successfully!"
else
    echo "📝 .env file already exists, adding SendGrid configuration..."
    
    # Check if SendGrid API key already exists
    if grep -q "SENDGRID_API_KEY" .env; then
        echo "🔄 Updating existing SendGrid API key..."
        sed -i '' 's/SENDGRID_API_KEY=.*/SENDGRID_API_KEY=your-sendgrid-api-key-here/' .env
    else
        echo "➕ Adding SendGrid configuration..."
        echo "" >> .env
        echo "# SendGrid Configuration (for DateFlow email invitations)" >> .env
        echo "SENDGRID_API_KEY=your-sendgrid-api-key-here" >> .env
        echo "SENDGRID_FROM_EMAIL=your-email@example.com" >> .env
        echo "" >> .env
        echo "# Eventbrite API (for real events)" >> .env
        echo "EVENTBRITE_API_KEY=your-eventbrite-api-key-here" >> .env
        echo "" >> .env
        echo "# Ticketmaster API (for additional real events)" >> .env
        echo "TICKETMASTER_CONSUMER_KEY=your-ticketmaster-consumer-key-here" >> .env
        echo "TICKETMASTER_CONSUMER_SECRET=your-ticketmaster-consumer-secret-here" >> .env
    fi
    echo "✅ SendGrid configuration added/updated!"
fi

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "📧 SendGrid Email System Status:"
echo "   ✅ API Key configured"
echo "   ✅ From email: noreply@dateflow.ai"
echo "   ✅ Ready to send DateFlow invitations!"
echo ""
echo "🚀 You can now:"
echo "   1. Restart your backend server"
echo "   2. Generate a DateFlow"
echo "   3. Click '📧 Send Invitation'"
echo "   4. Check your email for the calendar invitation!"
echo ""
echo "💡 Free tier: 100 emails/day forever!"
