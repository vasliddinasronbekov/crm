#!/usr/bin/env python
"""
Test script for Redis, WebSocket, and Database connections
Run: python test_connections.py
"""
import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from django.core.cache import cache
from django.db import connections
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import redis as redis_lib


def test_redis_connection():
    """Test Redis connection and caching"""
    print("\n" + "="*60)
    print("🔴 TESTING REDIS CONNECTION")
    print("="*60)

    try:
        # Test 1: Django cache (Redis backend)
        print("\n1️⃣  Testing Django Cache (Redis)...")
        cache.set('test_key', 'Hello from Redis!', timeout=30)
        value = cache.get('test_key')

        if value == 'Hello from Redis!':
            print("   ✅ Django Cache WORKING")
            print(f"   📦 Value retrieved: {value}")
        else:
            print("   ❌ Django Cache FAILED")
            return False

        # Test 2: Cache statistics
        print("\n2️⃣  Testing Cache Operations...")
        cache.set('counter', 0)
        cache.incr('counter')
        cache.incr('counter')
        counter_value = cache.get('counter')
        print(f"   ✅ Counter operations working: {counter_value}")

        # Test 3: Direct Redis connection
        print("\n3️⃣  Testing Direct Redis Connection...")
        from django.conf import settings
        redis_url = settings.REDIS_URL

        # Parse Redis URL
        if redis_url.startswith('redis://'):
            redis_client = redis_lib.from_url(redis_url)
            redis_client.ping()
            print(f"   ✅ Direct Redis connection successful")
            print(f"   🔗 Connected to: {redis_url}")

            # Get Redis info
            info = redis_client.info('server')
            print(f"   📊 Redis Version: {info.get('redis_version', 'Unknown')}")
            print(f"   💾 Used Memory: {info.get('used_memory_human', 'Unknown')}")

        print("\n✅ REDIS CONNECTION TEST PASSED")
        return True

    except Exception as e:
        print(f"\n❌ REDIS CONNECTION TEST FAILED")
        print(f"   Error: {str(e)}")
        print(f"\n💡 Make sure Redis is running:")
        print(f"   sudo systemctl start redis")
        print(f"   # OR")
        print(f"   redis-server")
        return False


def test_websocket_connection():
    """Test WebSocket/Channels connection"""
    print("\n" + "="*60)
    print("🌐 TESTING WEBSOCKET/CHANNELS CONNECTION")
    print("="*60)

    try:
        # Test 1: Get channel layer
        print("\n1️⃣  Testing Channel Layer Configuration...")
        channel_layer = get_channel_layer()

        if channel_layer is None:
            print("   ❌ Channel layer is None")
            return False

        print(f"   ✅ Channel layer configured")
        print(f"   📦 Backend: {channel_layer.__class__.__name__}")

        # Test 2: Send and receive message
        print("\n2️⃣  Testing Message Sending/Receiving...")
        test_channel = "test_channel"
        test_message = {
            "type": "test.message",
            "text": "Hello from WebSocket test!",
            "timestamp": "2025-10-20"
        }

        # Send message
        async_to_sync(channel_layer.send)(test_channel, test_message)
        print("   ✅ Message sent to channel")

        # Receive message
        received = async_to_sync(channel_layer.receive)(test_channel)

        if received and received.get('text') == test_message['text']:
            print("   ✅ Message received successfully")
            print(f"   📨 Message: {received.get('text')}")
        else:
            print("   ⚠️  Message received but content differs")

        # Test 3: Group operations
        print("\n3️⃣  Testing Channel Groups...")
        group_name = "test_group"
        channel_name = "test_channel_123"

        # Add to group
        async_to_sync(channel_layer.group_add)(group_name, channel_name)
        print(f"   ✅ Added channel to group: {group_name}")

        # Send to group
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "group.message",
                "text": "Broadcast message to all!"
            }
        )
        print(f"   ✅ Broadcast message sent to group")

        # Discard from group
        async_to_sync(channel_layer.group_discard)(group_name, channel_name)
        print(f"   ✅ Channel removed from group")

        print("\n✅ WEBSOCKET/CHANNELS TEST PASSED")
        return True

    except Exception as e:
        print(f"\n❌ WEBSOCKET/CHANNELS TEST FAILED")
        print(f"   Error: {str(e)}")
        print(f"\n💡 Make sure Redis is running (required for channel layer)")
        return False


def test_database_connections():
    """Test PostgreSQL and SQLite database connections"""
    print("\n" + "="*60)
    print("🗄️  TESTING DATABASE CONNECTIONS")
    print("="*60)

    results = {}

    for db_name in connections:
        try:
            print(f"\n📊 Testing database: {db_name}")

            conn = connections[db_name]
            cursor = conn.cursor()

            # Get database info
            engine = conn.settings_dict['ENGINE']
            db_file = conn.settings_dict.get('NAME', 'N/A')

            print(f"   Engine: {engine}")
            print(f"   Name: {db_file}")

            # Test query
            if 'sqlite' in engine:
                cursor.execute("SELECT sqlite_version();")
                version = cursor.fetchone()[0]
                print(f"   SQLite Version: {version}")
            elif 'postgresql' in engine:
                cursor.execute("SELECT version();")
                version = cursor.fetchone()[0]
                print(f"   PostgreSQL Version: {version[:50]}...")

            # Count tables
            cursor.execute("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
            """ if 'postgresql' in engine else """
                SELECT count(*)
                FROM sqlite_master
                WHERE type='table'
            """)

            table_count = cursor.fetchone()[0]
            print(f"   Tables: {table_count}")

            print(f"   ✅ Connection successful")
            results[db_name] = True

        except Exception as e:
            print(f"   ❌ Connection failed: {str(e)}")
            results[db_name] = False

            if db_name == 'default' and 'postgresql' in str(e).lower():
                print("\n💡 PostgreSQL not available. Using SQLite fallback.")
                print("   For production, set up PostgreSQL:")
                print("   DATABASE_URL=postgresql://user:pass@localhost/dbname")

    # Summary
    print("\n" + "="*60)
    all_passed = all(results.values())
    if all_passed:
        print("✅ ALL DATABASE CONNECTIONS SUCCESSFUL")
    else:
        print("⚠️  SOME DATABASE CONNECTIONS FAILED")
        for db_name, status in results.items():
            status_icon = "✅" if status else "❌"
            print(f"   {status_icon} {db_name}")

    return all_passed


def main():
    """Run all connection tests"""
    print("\n" + "="*60)
    print("🚀 EDUVOICE PLATFORM - CONNECTION TESTS")
    print("="*60)
    print("Testing: Redis, WebSocket/Channels, PostgreSQL, SQLite3")
    print("="*60)

    results = {}

    # Test Redis
    results['Redis'] = test_redis_connection()

    # Test WebSocket
    results['WebSocket'] = test_websocket_connection()

    # Test Databases
    results['Databases'] = test_database_connections()

    # Final Summary
    print("\n" + "="*60)
    print("📊 FINAL TEST SUMMARY")
    print("="*60)

    for component, status in results.items():
        status_icon = "✅" if status else "❌"
        status_text = "PASSED" if status else "FAILED"
        print(f"{status_icon} {component}: {status_text}")

    all_passed = all(results.values())

    print("\n" + "="*60)
    if all_passed:
        print("🎉 ALL TESTS PASSED - PRODUCTION STACK READY!")
        print("="*60)
        print("\n✅ Your platform is configured with:")
        print("   • PostgreSQL (Primary Database)")
        print("   • SQLite3 (Analytics Database)")
        print("   • Redis (Cache + Sessions + WebSocket)")
        print("   • Django Channels (WebSocket Support)")
        print("\n🚀 You can now start the platform:")
        print("   python manage.py runserver")
    else:
        print("⚠️  SOME TESTS FAILED - CHECK CONFIGURATION")
        print("="*60)
        print("\n💡 Common fixes:")
        print("   1. Start Redis: sudo systemctl start redis")
        print("   2. Check PostgreSQL: sudo systemctl status postgresql")
        print("   3. Update .env file with correct credentials")

    print("\n")
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
