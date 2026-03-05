#!/usr/bin/env python3
"""
Test TTS API endpoint with authentication
"""
import requests
import os

# Configuration
BASE_URL = "https://api.crmai.uz"
LOGIN_URL = f"{BASE_URL}/api/auth/login/"
TTS_URL = f"{BASE_URL}/api/v1/ai/tts/"

# Test credentials (you need a valid user)
# Replace with your actual credentials
USERNAME = "admin"  # or your test user
PASSWORD = "admin123"  # or your test password

def test_tts_api():
    """Test TTS API with proper authentication"""

    print("🔐 Step 1: Login to get JWT token...")
    try:
        login_response = requests.post(LOGIN_URL, json={
            "username": USERNAME,
            "password": PASSWORD
        })

        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            print("\n💡 Please create a user first:")
            print("   cd /home/gradientvvv/untilIwin/backend")
            print("   source venv/bin/activate")
            print("   python3 manage.py createsuperuser")
            return

        token = login_response.json().get("access")
        print(f"✅ Login successful! Token: {token[:20]}...")

    except Exception as e:
        print(f"❌ Login error: {e}")
        return

    print("\n🎤 Step 2: Testing TTS endpoint...")
    try:
        headers = {
            "Authorization": f"Bearer {token}"
        }

        tts_response = requests.post(TTS_URL,
            headers=headers,
            json={
                "text": "Salom! Men AI assistant. Sizga qanday yordam bera olaman?",
                "language": "uz"
            }
        )

        if tts_response.status_code != 200:
            print(f"❌ TTS failed: {tts_response.status_code}")
            print(f"Response: {tts_response.text}")
            return

        # Save the audio file
        output_file = "/tmp/tts_test_output.wav"
        with open(output_file, "wb") as f:
            f.write(tts_response.content)

        file_size = os.path.getsize(output_file)
        print(f"✅ TTS successful!")
        print(f"📁 Output file: {output_file}")
        print(f"📊 File size: {file_size} bytes")

        if file_size > 1000:
            print("✅ Audio file has proper size (contains actual audio data)")
            print(f"\n🎵 You can play it with: aplay {output_file}")
        else:
            print("⚠️  Audio file is too small, may only contain WAV header")

    except Exception as e:
        print(f"❌ TTS error: {e}")

if __name__ == "__main__":
    test_tts_api()
