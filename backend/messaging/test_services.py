# /mnt/usb/edu-api-project/messaging/test_services.py

import pytest
from unittest.mock import patch, MagicMock
from .services import send_sms

# Biz `messaging/services.py` fayli ichidagi `requests.post`'ni "soxtalashtiramiz".
# Bu dekorator test ishga tushganda `requests.post`'ni vaqtinchalik `MagicMock` ob'ekti bilan almashtiradi.
@patch('messaging.services.requests.post')
def test_send_sms_successful_call(mock_post):
    """
    `send_sms` funksiyasi tashqi API'ni to'g'ri chaqirayotganini va
    muvaffaqiyatli javobni to'g'ri qayta ishlayotganini tekshiradi.
    """
    # 1. TAYYORGARLIK (Arrange)
    # Mock ob'ektini sozlash. `requests.post` chaqirilganda nima bo'lishini belgilaymiz.
    
    # Eskiz'dan go'yoki keladigan javoblarni yaratamiz: biri token uchun, ikkinchisi SMS yuborish uchun.
    mock_login_response = MagicMock()
    mock_login_response.status_code = 200
    mock_login_response.json.return_value = {'data': {'token': 'test-token-12345'}}

    mock_send_response = MagicMock()
    mock_send_response.status_code = 200
    mock_send_response.json.return_value = {'status': 'SUCCESS'}
    
    # `requests.post` birinchi chaqirilganda token javobini, ikkinchi chaqirilganda
    # SMS yuborish javobini qaytarsin deymiz.
    mock_post.side_effect = [mock_login_response, mock_send_response]

    phone_number = '+998901234567'
    message = 'Test message'

    # 2. HARAKAT (Act)
    # Asosiy funksiyani chaqiramiz
    success = send_sms(phone_number, message)

    # 3. TASDIQLASH (Assert)
    # Funksiya `True` qaytarishi kerak
    assert success is True
    
    # `requests.post` ikki marta chaqirilganini tekshiramiz (login va send uchun)
    assert mock_post.call_count == 2
    
    # Ikkinchi chaqiruv (SMS yuborish) to'g'ri parametrlar bilan qilinganini tekshiramiz
    last_call_args, last_call_kwargs = mock_post.call_args
    assert last_call_kwargs['url'] == 'https://notify.eskiz.uz/api/message/sms/send'
    assert last_call_kwargs['headers']['Authorization'] == 'Bearer test-token-12345'
    assert last_call_kwargs['data']['mobile_phone'] == '998934043024' # Boshidagi '+' olingan holati
    assert last_call_kwargs['data']['message'] == message
