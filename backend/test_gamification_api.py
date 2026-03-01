"""
Test script for Gamification API
Run: python test_gamification_api.py
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8008/api"
# Replace with your actual token after logging in
TOKEN = "your_jwt_token_here"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_gamification_endpoints():
    """Test all gamification endpoints"""

    # Test 1: Get user's gamification profile
    print_section("1. Get User Gamification Profile")
    response = requests.get(
        f"{BASE_URL}/gamification/profile/my_profile/",
        headers=headers
    )
    if response.status_code == 200:
        data = response.json()
        print("✓ Profile retrieved successfully")
        print(f"Level: {data['level_info']['current_level']}")
        print(f"XP: {data['level_info']['total_xp']}/{data['level_info']['xp_to_next_level']}")
        print(f"Streak: {data['level_info']['current_streak_days']} days")
        print(f"Badges: {len(data['badges'])}")
        print(f"Achievements: {len(data['achievements'])}")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)

    # Test 2: Get all available badges
    print_section("2. Get All Badges")
    response = requests.get(
        f"{BASE_URL}/gamification/badges/",
        headers=headers
    )
    if response.status_code == 200:
        badges = response.json()
        print(f"✓ Found {len(badges)} badges")
        if badges:
            for badge in badges[:3]:  # Show first 3
                print(f"  - {badge['name']} ({badge['rarity']}): {badge['xp_reward']} XP")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 3: Get user's badges
    print_section("3. Get My Badges")
    response = requests.get(
        f"{BASE_URL}/gamification/badges/my_badges/",
        headers=headers
    )
    if response.status_code == 200:
        my_badges = response.json()
        print(f"✓ You have {len(my_badges)} badges")
        for badge in my_badges:
            print(f"  - {badge['badge']['name']} (earned: {badge['earned_at']})")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 4: Get user level info
    print_section("4. Get Level Info")
    response = requests.get(
        f"{BASE_URL}/gamification/levels/my_profile/",
        headers=headers
    )
    if response.status_code == 200:
        level_data = response.json()
        print("✓ Level info retrieved")
        print(f"Username: {level_data['username']}")
        print(f"Level: {level_data['current_level']}")
        print(f"XP: {level_data['total_xp']}")
        print(f"Progress: {level_data['xp_progress_percentage']}%")
        print(f"Current Streak: {level_data['current_streak_days']} days")
        print(f"Longest Streak: {level_data['longest_streak_days']} days")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 5: Get XP history
    print_section("5. Get XP History")
    response = requests.get(
        f"{BASE_URL}/gamification/levels/xp_history/?limit=5",
        headers=headers
    )
    if response.status_code == 200:
        transactions = response.json()
        print(f"✓ Last {len(transactions)} XP transactions:")
        for txn in transactions:
            print(f"  [{txn['transaction_type']}] +{txn['amount']} XP - {txn['reason']}")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 6: Get daily challenges
    print_section("6. Get Today's Challenges")
    response = requests.get(
        f"{BASE_URL}/gamification/daily-challenges/my_challenges/",
        headers=headers
    )
    if response.status_code == 200:
        challenges = response.json()
        print(f"✓ You have {len(challenges)} challenges today:")
        for challenge in challenges:
            status = "✓ Completed" if challenge['is_completed'] else f"{challenge['current_progress']}/{challenge['challenge']['target_value']}"
            print(f"  - {challenge['challenge']['title']}: {status}")
            print(f"    Reward: {challenge['challenge']['xp_reward']} XP, {challenge['challenge']['coins_reward']} coins")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 7: Get leaderboard
    print_section("7. Get Leaderboard (Top 10)")
    response = requests.get(
        f"{BASE_URL}/gamification/leaderboard/?type=xp&limit=10",
        headers=headers
    )
    if response.status_code == 200:
        leaderboard = response.json()
        print(f"✓ Top {len(leaderboard)} users by XP:")
        for entry in leaderboard[:5]:  # Show top 5
            print(f"  #{entry['rank']} - {entry['first_name']} (Level {entry['level']}): {entry['score']} XP")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 8: Get my rank
    print_section("8. Get My Rank")
    response = requests.get(
        f"{BASE_URL}/gamification/leaderboard/my_rank/",
        headers=headers
    )
    if response.status_code == 200:
        rank_data = response.json()
        print("✓ Your Rankings:")
        print(f"  XP Rank: #{rank_data['xp_rank']} / {rank_data['total_users']}")
        print(f"  Level Rank: #{rank_data['level_rank']} / {rank_data['total_users']}")
        print(f"  Streak Rank: #{rank_data['streak_rank']} / {rank_data['total_users']}")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 9: Get achievements
    print_section("9. Get All Achievements")
    response = requests.get(
        f"{BASE_URL}/gamification/achievements/",
        headers=headers
    )
    if response.status_code == 200:
        achievements = response.json()
        print(f"✓ Found {len(achievements)} achievements")
        for achievement in achievements[:3]:  # Show first 3
            print(f"  - {achievement['name']} ({achievement['category']})")
            print(f"    Tiers: {len(achievement['tiers'])}")
    else:
        print(f"✗ Failed: {response.status_code}")

    # Test 10: Get my achievements
    print_section("10. Get My Achievements")
    response = requests.get(
        f"{BASE_URL}/gamification/achievements/my_achievements/",
        headers=headers
    )
    if response.status_code == 200:
        my_achievements = response.json()
        print(f"✓ You are tracking {len(my_achievements)} achievements")
        for achievement in my_achievements:
            tier_name = achievement['current_tier_info']['name'] if achievement['current_tier_info'] else 'Not unlocked'
            print(f"  - {achievement['achievement']['name']}: Tier {achievement['current_tier']} ({tier_name})")
    else:
        print(f"✗ Failed: {response.status_code}")

    print("\n" + "="*60)
    print("  Testing Complete!")
    print("="*60)


if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║     GAMIFICATION API TEST SUITE                        ║
    ╚════════════════════════════════════════════════════════╝
    """)

    print("⚠️  Make sure to:")
    print("1. Start the Django server: python manage.py runserver 8008")
    print("2. Get your JWT token from login endpoint")
    print("3. Update TOKEN variable in this script")
    print("4. Run seed command: python manage.py seed_gamification")
    print()

    input("Press Enter to start testing...")

    try:
        test_gamification_endpoints()
    except requests.exceptions.ConnectionError:
        print("\n✗ ERROR: Could not connect to server.")
        print("Make sure Django is running on http://localhost:8008")
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
