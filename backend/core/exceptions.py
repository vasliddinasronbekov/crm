# /mnt/usb/untilIwin/backend/core/exceptions.py

from rest_framework.views import exception_handler
from rest_framework.response import Response
from django.conf import settings # Django'ning asosiy sozlamalarini import qilamiz

def custom_exception_handler(exc, context):
    # Birinchi navbatda DRF'ning standart xatolik qayta ishlovchisiga murojaat qilamiz
    response = exception_handler(exc, context)

    # Agar DRF standart javob qaytargan bo'lsa, uni o'zimizning formatga o'giramiz
    if response is not None:
        custom_response_data = {
            'success': False,
            'error': {
                'code': response.status_code * 100 + 1,
                'message': 'Xatolik yuz berdi.',
                'details': response.data
            }
        }
        
        if 'detail' in response.data:
            if not isinstance(response.data['detail'], dict):
                custom_response_data['error']['message'] = response.data.pop('detail')
        
        if not custom_response_data['error']['details'] or custom_response_data['error']['details'] == custom_response_data['error']['message']:
            del custom_response_data['error']['details']

        response.data = custom_response_data
    
    # Agar bu Django yoki Python'ning kutilmagan 500 xatosi bo'lsa
    # va `response` `None` bo'lib qaytsa (DEBUG=False rejimida),
    # biz xavfsiz umumiy xabarni qaytaramiz.
    elif response is None and not settings.DEBUG:
         return Response({
            'success': False,
            'error': {
                'code': 50001,
                'message': 'Serverda kutilmagan ichki xatolik yuz berdi.'
            }
        }, status=500)

    return response
