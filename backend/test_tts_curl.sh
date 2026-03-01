#!/bin/bash
# TTS API Test Script with curl

echo "🔐 Step 1: Login to get JWT token..."
echo ""

# Login and get token (replace with your actual credentials)
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8008/api/v1/student-profile/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin"
  }')

# Extract access token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    echo ""
    echo "💡 Please update the script with your correct username/password"
    echo "   Or create a user: python3 manage.py createsuperuser"
    exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:30}..."
echo ""

echo "🎤 Step 2: Testing TTS API..."
echo ""

# Test TTS API
curl -X POST http://localhost:8008/api/v1/ai/tts/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Salom! Men AI assistant. Sizga qanday yordam bera olaman?"
  }' \
  --output /tmp/tts_output.wav

echo ""
echo "✅ TTS request completed!"
echo ""

# Check file size
if [ -f /tmp/tts_output.wav ]; then
    FILE_SIZE=$(stat -f%z /tmp/tts_output.wav 2>/dev/null || stat -c%s /tmp/tts_output.wav 2>/dev/null)
    echo "📁 Output file: /tmp/tts_output.wav"
    echo "📊 File size: $FILE_SIZE bytes"
    echo ""

    if [ "$FILE_SIZE" -gt 1000 ]; then
        echo "✅ SUCCESS! Audio file has proper size (contains audio data)"
        echo "🎵 Play with: aplay /tmp/tts_output.wav"
    else
        echo "⚠️  File too small (only WAV header), TTS may have failed"
    fi
else
    echo "❌ Output file not created"
fi
