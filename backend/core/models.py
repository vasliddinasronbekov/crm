# /mnt/usb/edu-api-project/core/models.py

from django.db import models
# from users.models import User  # <-- BU QATORNI O'CHIRAMIZ. Endi bu kerak emas.

class Region(models.Model):
    """Hududlar uchun lug'at (masalan, Andijon, Toshkent, Farg'ona)"""
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name

class Comment(models.Model):
    """
    Turli ob'ektlarga (masalan, Talaba, Guruh, Lid) izoh qoldirish uchun.
    Hozircha faqat Talabaga izoh qoldirishni implementatsiya qilamiz.
    """
    # --- O'ZGARISHLAR SHU YERDA ---
    # To'g'ridan-to'g'ri `User` o'rniga, uning manzilini matn ko'rinishida yozamiz
    # Format: 'app_nomi.Model_nomi'
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='comments', help_text="Izoh kim haqida")
    author = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='authored_comments', help_text="Izoh muallifi")

    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        author_name = self.author.username if self.author else 'Noma\'lum'
        user_name = self.user.username if self.user else 'Noma\'lum'
        return f"Comment by {author_name} on {user_name}"