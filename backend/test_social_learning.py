#!/usr/bin/env python3
"""
Test Script for Social Learning API

Tests all Social Learning endpoints including:
- Forums & Discussion Boards
- Study Groups
- Social Feed
- Peer Messaging
- Notifications

Usage:
    python test_social_learning.py
"""

import requests
import json
from pprint import pprint

# Configuration
BASE_URL = "http://localhost:8008/api/social"
AUTH_URL = "http://localhost:8008/api/auth/login/"

# Get your auth token by logging in
# Replace with your credentials
USERNAME = "admin"  # Update with your username
PASSWORD = "admin123"  # Update with your password

def get_auth_token():
    """Login and get JWT token"""
    response = requests.post(AUTH_URL, json={
        "username": USERNAME,
        "password": PASSWORD
    })

    if response.status_code == 200:
        data = response.json()
        return data.get('access')
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None

def make_request(method, endpoint, token, data=None, params=None):
    """Make authenticated API request"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    if method == "GET":
        response = requests.get(url, headers=headers, params=params)
    elif method == "POST":
        response = requests.post(url, headers=headers, json=data)
    elif method == "PUT":
        response = requests.put(url, headers=headers, json=data)
    elif method == "DELETE":
        response = requests.delete(url, headers=headers)

    return response


def test_forums(token):
    """Test forum endpoints"""
    print("\n" + "="*60)
    print("TESTING FORUMS")
    print("="*60)

    # 1. Get forum categories
    print("\n📂 Getting forum categories...")
    response = make_request("GET", "/forum-categories/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        # Handle both paginated and non-paginated responses
        categories = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(categories)} categories")
        if categories:
            pprint(categories[0])

    # 2. Get forums
    print("\n💬 Getting forums...")
    response = make_request("GET", "/forums/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        forums = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(forums)} forums")
        if forums:
            pprint(forums[0])

    # 3. Get topics
    print("\n📝 Getting forum topics...")
    response = make_request("GET", "/topics/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        topics = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(topics)} topics")
        if topics:
            pprint(topics[0])

    # 4. Create a topic (if we have a forum)
    response = make_request("GET", "/forums/", token)
    if response.status_code == 200:
        data = response.json()
        forums = data.get('results', data) if isinstance(data, dict) else data
        if forums:
            forum_id = forums[0]['id']

            print(f"\n✍️ Creating new topic in forum {forum_id}...")
            topic_data = {
                "forum": forum_id,
                "title": "Test Topic from API",
                "content": "This is a test topic created via API testing script."
            }
            response = make_request("POST", "/topics/", token, data=topic_data)
            print(f"Status: {response.status_code}")
            if response.status_code == 201:
                new_topic = response.json()
                print(f"✅ Created topic: {new_topic['title']}")
                pprint(new_topic)

                # 5. Upvote the topic
                topic_id = new_topic['id']
                print(f"\n👍 Upvoting topic {topic_id}...")
                response = make_request("POST", f"/topics/{topic_id}/upvote/", token)
                print(f"Status: {response.status_code}")
                if response.status_code == 200:
                    print(f"✅ Upvoted! New count: {response.json().get('upvote_count')}")


def test_study_groups(token):
    """Test study group endpoints"""
    print("\n" + "="*60)
    print("TESTING STUDY GROUPS")
    print("="*60)

    # 1. Get study groups
    print("\n👥 Getting study groups...")
    response = make_request("GET", "/study-groups/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        groups = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(groups)} study groups")
        if groups:
            pprint(groups[0])

    # 2. Create a study group
    print("\n✨ Creating new study group...")
    group_data = {
        "name": "API Test Study Group",
        "description": "This is a test study group created via API.",
        "is_public": True,
        "max_members": 50,
        "require_approval": False
    }
    response = make_request("POST", "/study-groups/", token, data=group_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        new_group = response.json()
        print(f"✅ Created group: {new_group['name']}")
        pprint(new_group)

        group_id = new_group['id']

        # 3. Get group members
        print(f"\n👫 Getting members of group {group_id}...")
        response = make_request("GET", f"/study-groups/{group_id}/members/", token)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            members = response.json()
            print(f"Found {len(members)} members")

        # 4. Create a post in the group
        print(f"\n📢 Creating post in group {group_id}...")
        post_data = {
            "group": group_id,
            "content": "Hello everyone! This is a test post via API.",
            "attachments": []
        }
        response = make_request("POST", "/group-posts/", token, data=post_data)
        print(f"Status: {response.status_code}")
        if response.status_code == 201:
            new_post = response.json()
            print(f"✅ Created post!")
            pprint(new_post)

            # 5. Like the post
            post_id = new_post['id']
            print(f"\n❤️ Liking post {post_id}...")
            response = make_request("POST", f"/group-posts/{post_id}/like/", token)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print(f"✅ Liked! New count: {response.json().get('like_count')}")


def test_social_feed(token):
    """Test social feed endpoints"""
    print("\n" + "="*60)
    print("TESTING SOCIAL FEED")
    print("="*60)

    # 1. Get feed items
    print("\n📰 Getting social feed...")
    response = make_request("GET", "/feed/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        feed_items = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(feed_items)} feed items")
        if feed_items:
            pprint(feed_items[0])

    # 2. Get my feed
    print("\n📱 Getting my feed...")
    response = make_request("GET", "/feed/", token, params={"type": "my_feed"})
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        my_feed = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(my_feed)} items in my feed")


def test_messaging(token):
    """Test messaging endpoints"""
    print("\n" + "="*60)
    print("TESTING MESSAGING")
    print("="*60)

    # 1. Get conversations
    print("\n💬 Getting conversations...")
    response = make_request("GET", "/conversations/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        conversations = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(conversations)} conversations")
        if conversations:
            pprint(conversations[0])

            # 2. Get messages in first conversation
            conv_id = conversations[0]['id']
            print(f"\n📨 Getting messages in conversation {conv_id}...")
            response = make_request("GET", f"/conversations/{conv_id}/messages/", token)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                msg_data = response.json()
                messages = msg_data.get('results', msg_data) if isinstance(msg_data, dict) else msg_data
                print(f"Found {len(messages)} messages")


def test_notifications(token):
    """Test notifications endpoints"""
    print("\n" + "="*60)
    print("TESTING NOTIFICATIONS")
    print("="*60)

    # 1. Get notifications
    print("\n🔔 Getting notifications...")
    response = make_request("GET", "/notifications/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        notifications = data.get('results', data) if isinstance(data, dict) else data
        print(f"Found {len(notifications)} notifications")
        if notifications:
            pprint(notifications[0])

    # 2. Get unread count
    print("\n📬 Getting unread notification count...")
    response = make_request("GET", "/notifications/unread_count/", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        unread_count = response.json()
        print(f"Unread notifications: {unread_count.get('unread_count')}")


def main():
    """Run all tests"""
    print("=" * 60)
    print("SOCIAL LEARNING API TEST SUITE")
    print("=" * 60)

    # Get auth token
    print("\n🔐 Authenticating...")
    token = get_auth_token()

    if not token:
        print("\n❌ Failed to get authentication token. Please check your credentials.")
        return

    print(f"✅ Got auth token: {token[:20]}...")

    # Run tests
    try:
        test_forums(token)
        test_study_groups(token)
        test_social_feed(token)
        test_messaging(token)
        test_notifications(token)

        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED!")
        print("="*60)

    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
