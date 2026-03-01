from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes


# ----------- STT Serializers -----------
class STTRequestSerializer(serializers.Serializer):
    file = serializers.FileField(help_text="WAV audio file")


class STTResponseSerializer(serializers.Serializer):
    raw = serializers.CharField(help_text="STT natijasidagi xom matn")
    corrected = serializers.CharField(help_text="Imlo to‘g‘rilangan matn")
    duration = serializers.FloatField(help_text="Audio fayl uzunligi (sekundlarda)")


# ----------- Intent Serializers -----------
class AIIntentRequestSerializer(serializers.Serializer):
    text = serializers.CharField(
        help_text="Foydalanuvchi yuborgan matn yoki STT natijasi",
    )
    
    class Meta:
        swagger_schema_fields = {
            'text': {
                'example': "Balansim qancha qoldi?"
            }
        }


class IntentNLUSerializer(serializers.Serializer):
    intent = serializers.CharField(help_text="Aniqlangan intent nomi")
    confidence = serializers.FloatField(help_text="Ishtirok ehtimoli")
    method = serializers.CharField(help_text="Aniqlash usuli (rule/ml)")
    entities = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        help_text="Aniqlangan entitilar (masalan, phone, amount, date)",
    )


class IntentResultSerializer(serializers.Serializer):
    status = serializers.CharField(help_text="Natija statusi")
    response = serializers.CharField(help_text="Natija xabari", required=False)
    balance = serializers.CharField(required=False)
    last_payment = serializers.CharField(required=False)
    course = serializers.CharField(required=False)
    schedule = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="Jadvaldagi darslar ro‘yxati",
    )
    phone = serializers.CharField(required=False)


class AIIntentResponseSerializer(serializers.Serializer):
    nlu = IntentNLUSerializer()
    result = IntentResultSerializer()

    class Meta:
        swagger_schema_fields = {
            'nlu': {'example': {"intent": "check_balance", "confidence": 0.95, "method": "ml", "entities": {}}},
            'result': {'example': {"status": "ok", "response": "Your balance is 15000.00 UZS."}},
        }


# ----------- Apply Intent Serializer -----------
class ApplyIntentSerializer(serializers.Serializer):
    nlu = IntentNLUSerializer()
    transcript = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Asl foydalanuvchi matni (agar mavjud bo‘lsa)",
    )

# ----------- TTS Serializers -----------
class TTSRequestSerializer(serializers.Serializer):
    text = serializers.CharField(
        help_text="Ovozga aylantiriladigan matn",
    )


class TTSResponseSerializer(serializers.Serializer):
    file = serializers.FileField(
        help_text="Yaratilgan WAV audio fayl",
    )