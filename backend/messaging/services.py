# /mnt/usb/edu-api-project/messaging/services.py

import requests
from decouple import config

# Eskiz API manzillari
ESKIZ_API_URL = "https://notify.eskiz.uz/api/"

# .env faylidan ma'lumotlarni o'qish
ESKIZ_EMAIL = config('ESKIZ_EMAIL', default='')
ESKIZ_API_KEY = config('ESKIZ_API_KEY', default='')

def get_eskiz_token():
    """Eskiz.uz'dan vaqtinchalik 'token' oladi."""
    try:
        response = requests.post(
            f"{ESKIZ_API_URL}auth/login",
            data={'email': ESKIZ_EMAIL, 'password': ESKIZ_API_KEY}
        )
        response.raise_for_status()  # Agar xato bo'lsa (4xx, 5xx), exception chiqaradi
        token = response.json().get('data', {}).get('token')
        return token
    except requests.exceptions.RequestException as e:
        print(f"Error getting Eskiz token: {e}")
        return None

def send_sms(phone_number, message_text):
    """
    Berilgan telefon raqamga Eskiz.uz orqali SMS yuboradi.
    Muvaffaqiyatli bo'lsa True, aks holda False qaytaradi.
    """
    token = get_eskiz_token()
    if not token:
        return False

    # Telefon raqamini to'g'ri formatga keltirish (boshidagi '+' ni olib tashlash)
    if phone_number.startswith('+'):
        phone_number = phone_number[1:]

    try:
        headers = {'Authorization': f'Bearer {token}'}
        payload = {
            'mobile_phone': phone_number,
            'message': message_text,
            'from': '4546',  # Eskiz'da ro'yxatdan o'tgan alfa-nom
            # 'callback_url': '...' # Agar SMS statusi haqida ma'lumot olish kerak bo'lsa
        }

        response = requests.post(
            f"{ESKIZ_API_URL}message/sms/send",
            headers=headers,
            data=payload
        )
        response.raise_for_status()

        # Agar muvaffaqiyatli bo'lsa, Eskiz "SUCCESS" degan javob qaytaradi.
        if response.json().get('status') == 'SUCCESS':
            return True
        else:
            print(f"Failed to send SMS to {phone_number}: {response.json()}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"Error sending SMS to {phone_number}: {e}")
        return False