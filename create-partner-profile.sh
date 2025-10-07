#!/bin/bash

# Create Partner Profile Script
# This script logs in and creates a partner profile for your user

API_BASE="http://localhost:5001/api"
EMAIL="afsarijustin@gmail.com"
PASSWORD="Loserhihi1!"

echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo ""

echo "💕 Creating partner profile..."
CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/partner" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Christine",
    "age": 28,
    "location": "New York, NY",
    "bio": "Loves electronic music, dancing, and nightlife. Big fan of John Summit and raves.",
    "interests": ["music", "dancing", "fitness", "art", "travel", "hiking"],
    "preferences": {
      "cuisine_preferences": ["italian", "japanese", "mexican", "thai"],
      "activity_preferences": ["concerts", "restaurants", "bars", "live_music", "dancing", "hiking"],
      "budget_preferences": "$$",
      "transportation": "public"
    },
    "lifestyle": {
      "occupation": "Marketing Manager",
      "relationship_goals": "serious_relationship",
      "drinking": "occasionally"
    }
  }')

echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Verify by fetching the partner profile
echo "🔍 Verifying partner profile..."
GET_RESPONSE=$(curl -s -X GET "$API_BASE/partner" \
  -H "Authorization: Bearer $TOKEN")

echo "$GET_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_RESPONSE"
echo ""

echo "✅ Done! Your partner profile is now in the database."
echo "💡 Now send a message in the chat and check your backend logs for combined interests!"

