# /mnt/usb/edu-api-project/messaging/models.py

import uuid
from django.db import models
from users.models import User

class MessageTemplate(models.Model):
    """
    Qayta ishlatish mumkin bo'lgan xabar shablonlari.
    Masalan: "Hurmatli {student_name}, ertangi darsingiz soat {time} da."
    """
    name = models.CharField(max_length=255, unique=True, help_text="Shablon nomi (masalan, 'Tug'ilgan kun tabrigi')")
    text = models.TextField(help_text="Xabar matni. O'zgaruvchilar uchun {student_name} kabi belgilardan foydalaning.")

    def __str__(self):
        return self.name

class SmsHistory(models.Model):
    """
    Yuborilgan har bir SMS yoki xabar haqidagi ma'lumotni saqlaydi.
    """
    STATUS_CHOICES = [
        ('sent', 'Yuborilgan'),
        ('pending', 'Kutilmoqda'),
        ('failed', 'Xatolik'),
    ]
    
    recipient = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, help_text="Xabar qabul qiluvchi foydalanuvchi")
    phone_number = models.CharField(max_length=20, help_text="Xabar yuborilgan telefon raqam")
    message_text = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(auto_now_add=True)
    # sms_service_id = models.CharField(max_length=255, blank=True, null=True) # SMS provayderidan keladigan ID'ni saqlash uchun
    
    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"To: {self.phone_number} | Status: {self.status}"

class AutomaticMessage(models.Model):
    """
    Ma'lum bir hodisaga qarab avtomatik xabar yuborish uchun qoidalar.
    """
    TRIGGER_CHOICES = [
        ('birthday', "Tug'ilgan kunida"),
        ('payment_due', "To'lov kunidan 3 kun oldin"),
        ('new_group', "Yangi guruhga qo'shilganda"),
    ]
    name = models.CharField(max_length=255, help_text="Bu avto-xabar nima uchun ekanligi")
    trigger_event = models.CharField(max_length=50, choices=TRIGGER_CHOICES, unique=True, help_text="Xabarni yuborishga sabab bo'ladigan hodisa")
    message_template = models.ForeignKey(MessageTemplate, on_delete=models.CASCADE, help_text="Ushbu hodisada yuboriladigan xabar shabloni")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
class Conversation(models.Model):
    """
    Represents a conversation/chat thread between user(s) and AI or between users.
    """
    CONVERSATION_TYPE_CHOICES = [
        ('ai_chat', 'AI Chat'),
        ('voice_chat', 'Voice Chat'),
        ('support', 'Support'),
        ('direct', 'Direct Message'),
        ('platform', 'Platform'),
        ('sms', 'SMS'),
    ]

    conversation_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, help_text="Unique conversation identifier")
    conversation_type = models.CharField(max_length=20, choices=CONVERSATION_TYPE_CHOICES, default='platform')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations', help_text="Primary user in conversation")
    participants = models.ManyToManyField(User, related_name='chat_conversations', blank=True)
    title = models.CharField(max_length=255, blank=True, null=True, help_text="Conversation title/subject")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional metadata (context, settings, etc.)")

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['conversation_id']),
        ]

    def __str__(self):
        return f"Conversation {self.conversation_id} - {self.user.username}"


class ChatMessage(models.Model):
    """
    Individual messages within a conversation with support for text, audio, and rich content.
    """
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('audio', 'Audio'),
        ('image', 'Image'),
        ('file', 'File'),
        ('system', 'System'),
    ]

    SENDER_TYPE_CHOICES = [
        ('user', 'User'),
        ('ai', 'AI Assistant'),
        ('system', 'System'),
    ]

    STATUS_CHOICES = [
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
        ('failed', 'Failed'),
    ]

    message_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, help_text="Unique message identifier")
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=10, choices=SENDER_TYPE_CHOICES, default='user')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_messages')

    # Message content
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text')
    content = models.TextField(help_text="Text content or description")
    audio_url = models.URLField(blank=True, null=True, help_text="URL to audio file")
    audio_duration = models.FloatField(blank=True, null=True, help_text="Audio duration in seconds")
    file_url = models.URLField(blank=True, null=True, help_text="URL to attached file")

    # AI/Intent metadata
    intent = models.CharField(max_length=100, blank=True, null=True, help_text="Detected intent")
    confidence = models.FloatField(blank=True, null=True, help_text="Intent confidence score")
    entities = models.JSONField(default=dict, blank=True, help_text="Extracted entities")

    # Status and timestamps
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)

    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True, help_text="Provider info, processing time, cost, etc.")

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['message_id']),
            models.Index(fields=['sender', '-created_at']),
        ]

    def __str__(self):
        return f"{self.sender_type}: {self.content[:50]}..."


class UserPresence(models.Model):
    """
    Tracks user online/offline status for real-time features.
    """
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('away', 'Away'),
        ('offline', 'Offline'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='presence')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='offline')
    last_seen = models.DateTimeField(auto_now=True)
    is_typing = models.BooleanField(default=False)
    typing_in_conversation = models.ForeignKey(Conversation, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name_plural = "User presences"

    def __str__(self):
        return f"{self.user.username} - {self.status}"


class ConversationAnalytics(models.Model):
    """
    Analytics and metrics for conversations and intents.
    """
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='analytics')
    date = models.DateField(auto_now_add=True, db_index=True)

    # Message counts
    total_messages = models.IntegerField(default=0)
    user_messages = models.IntegerField(default=0)
    ai_messages = models.IntegerField(default=0)

    # Intent metrics
    intents_detected = models.JSONField(default=dict, help_text="Intent name -> count mapping")
    avg_confidence = models.FloatField(blank=True, null=True)

    # Performance metrics
    avg_response_time = models.FloatField(blank=True, null=True, help_text="Average AI response time in seconds")
    total_audio_duration = models.FloatField(default=0.0, help_text="Total audio duration in seconds")

    # Cost tracking
    total_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0, help_text="Total cost in USD")

    class Meta:
        ordering = ['-date']
        unique_together = [['conversation', 'date']]
        verbose_name_plural = "Conversation analytics"

    def __str__(self):
        return f"Analytics for {self.conversation} on {self.date}"


# Import knowledge base models
from ai.knowledge_base import (
    PlatformKnowledge,
    ConversationLearning,
    KnowledgeCategory
)

# Import email models
from .email_models import EmailTemplate, EmailCampaign, EmailLog, AutomatedEmail

