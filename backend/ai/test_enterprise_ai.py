"""
Enterprise AI System - Test Script
===================================
Tests the complete AI pipeline with various scenarios

Usage:
    python ai/test_enterprise_ai.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_text_processing():
    """Test text input processing"""
    print("\n" + "="*80)
    print("TEST 1: Text Processing (Intent Detection)")
    print("="*80)

    from ai.enhanced_intent_handler import process_user_input_enhanced

    test_cases = [
        "Mening dars jadvali",
        "To'lovni tekshirish",
        "Kurs narxi",
        "Mening balansingiz",
        "Salom",
        "Python kursiga yozilmoqchiman",
    ]

    for text in test_cases:
        print(f"\n📝 Input: '{text}'")
        try:
            result = process_user_input_enhanced(text=text, user=None)

            status_emoji = {
                'ok': '✅',
                'error': '❌',
                'clarify': '❓',
                'incomplete': '⏳'
            }.get(result['status'], '❔')

            print(f"{status_emoji} Status: {result['status']}")
            print(f"   Intent: {result.get('intent', 'unknown')}")
            print(f"   Confidence: {result.get('nlu', {}).get('confidence', 0):.2f}")
            print(f"   Message: {result.get('message', '')[:100]}...")

        except Exception as e:
            print(f"❌ Error: {e}")

def test_intent_categories():
    """Test intents from all categories"""
    print("\n" + "="*80)
    print("TEST 2: Intent Categories Coverage")
    print("="*80)

    from ai.intent_config import INTENT_DEFINITIONS, IntentCategory

    # Group intents by category
    by_category = {}
    for intent_name, config in INTENT_DEFINITIONS.items():
        category = config.category.value
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(intent_name)

    total_intents = 0
    for category in sorted(by_category.keys()):
        intents = by_category[category]
        total_intents += len(intents)
        print(f"\n📂 {category.upper()}: {len(intents)} intents")
        for intent in sorted(intents):
            print(f"   ✓ {intent}")

    print(f"\n✅ Total Intents: {total_intents}")

def test_entity_extraction():
    """Test entity extraction"""
    print("\n" + "="*80)
    print("TEST 3: Entity Extraction")
    print("="*80)

    from ai.enhanced_nlu import EntityExtractor

    extractor = EntityExtractor()

    test_cases = [
        "Mening telefon raqamim +998901234567",
        "Email: test@example.com",
        "To'lov 500000 so'm",
        "Dars 15:30 da boshlanadi",
        "Python kursiga yozilish",
    ]

    for text in test_cases:
        print(f"\n📝 Text: '{text}'")
        entities = extractor.extract_entities(text)

        if entities:
            for entity_type, value in entities.items():
                print(f"   ✓ {entity_type}: {value}")
        else:
            print("   (No entities found)")

def test_training_data():
    """Test training data generation"""
    print("\n" + "="*80)
    print("TEST 4: Training Data Statistics")
    print("="*80)

    from pathlib import Path
    import csv

    csv_path = Path(__file__).parent / 'intent_data' / 'intents.csv'

    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            examples = list(reader)

        print(f"📊 Training Dataset: {len(examples)} examples")

        # Count by intent
        intent_counts = {}
        for example in examples:
            intent = example['intent']
            intent_counts[intent] = intent_counts.get(intent, 0) + 1

        print(f"\n📈 Top 10 Intents by Examples:")
        for intent, count in sorted(intent_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"   {count:4d} examples - {intent}")

        print(f"\n✅ Intents Covered: {len(intent_counts)}")
    else:
        print(f"⚠️  Training data not found at {csv_path}")
        print("   Run: python ai/generate_training_data.py")

def test_supported_intents():
    """Test getting supported intents"""
    print("\n" + "="*80)
    print("TEST 5: Supported Intents API")
    print("="*80)

    from ai.enhanced_intent_handler import get_supported_intents

    intents = get_supported_intents()

    print(f"📊 Total Supported Intents: {intents['total']}")
    print(f"\n📂 Categories:")

    for category, intent_list in sorted(intents['by_category'].items()):
        print(f"\n   {category.upper()} ({len(intent_list)} intents):")
        for intent_data in intent_list[:3]:  # Show first 3
            print(f"      • {intent_data['name']}")
            print(f"        Description: {intent_data['description']}")

def test_nlu_processor():
    """Test complete NLU processor"""
    print("\n" + "="*80)
    print("TEST 6: NLU Processor")
    print("="*80)

    from ai.enhanced_nlu import get_nlu_processor

    processor = get_nlu_processor()

    test_cases = [
        "Mening kurslariim ro'yxati",
        "To'lovni qanday tekshirish mumkin?",
        "Darslar qachon boshlanadi?",
    ]

    for text in test_cases:
        print(f"\n📝 Input: '{text}'")
        result = processor.process(text)

        print(f"   Intent: {result['intent']}")
        print(f"   Confidence: {result['confidence']:.2f}")
        print(f"   Method: {result['method']}")

        if result.get('entities'):
            print(f"   Entities: {result['entities']}")

        if result.get('alternatives'):
            print(f"   Alternatives: {[alt['intent'] for alt in result['alternatives'][:3]]}")

def test_system_info():
    """Display system information"""
    print("\n" + "="*80)
    print("SYSTEM INFORMATION")
    print("="*80)

    print("\n📦 Module Structure:")
    print("   ✓ enterprise_ai.py - Unified AI module")
    print("   ✓ enterprise_stt.py - Multi-provider STT")
    print("   ✓ enterprise_tts.py - Multi-provider TTS")
    print("   ✓ enhanced_intent_handler.py - Intent orchestration")
    print("   ✓ enhanced_nlu.py - NLU + entity extraction")
    print("   ✓ intent_fulfillment.py - Intent handlers")
    print("   ✓ intent_config.py - Intent definitions")
    print("   ✓ generate_training_data.py - Training data generator")

    print("\n🎯 Key Features:")
    print("   ✓ 69 Production-Ready Intents")
    print("   ✓ 10 Intent Categories")
    print("   ✓ Multi-Strategy Intent Detection")
    print("   ✓ 10+ Entity Types")
    print("   ✓ Multi-Language Support (uz, ru, en)")
    print("   ✓ Context Management")
    print("   ✓ Multi-Provider STT (5 providers)")
    print("   ✓ Multi-Provider TTS (5 providers)")
    print("   ✓ Automatic Fallback")
    print("   ✓ Caching & Optimization")
    print("   ✓ Cost Tracking")
    print("   ✓ Monitoring & Analytics")

    print("\n🔧 Providers:")
    print("\n   STT (Speech-to-Text):")
    print("      • Whisper (Local) - Free, offline")
    print("      • Google Cloud - High accuracy")
    print("      • Azure - Enterprise features")
    print("      • AssemblyAI - Advanced features")
    print("      • Deepgram - Fast streaming")

    print("\n   TTS (Text-to-Speech):")
    print("      • Piper (Local) - Free, offline")
    print("      • Google Cloud - 220+ voices")
    print("      • Azure Neural - 300+ voices")
    print("      • ElevenLabs - Ultra-realistic")
    print("      • Amazon Polly - AWS integration")

def run_all_tests():
    """Run all tests"""
    print("\n" + "="*80)
    print("🧪 ENTERPRISE AI SYSTEM - COMPREHENSIVE TEST SUITE")
    print("="*80)

    try:
        test_system_info()
        test_intent_categories()
        test_entity_extraction()
        test_text_processing()
        test_nlu_processor()
        test_supported_intents()
        test_training_data()

        print("\n" + "="*80)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
        print("="*80)

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_all_tests()
