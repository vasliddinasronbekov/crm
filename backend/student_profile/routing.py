from django.urls import path

from .consumers import AccountingLogConsumer


websocket_urlpatterns = [
    path('ws/accounting/logs/', AccountingLogConsumer.as_asgi()),
]
