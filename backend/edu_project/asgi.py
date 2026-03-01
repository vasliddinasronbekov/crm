import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
import ai.routing
import messaging.routing
import student_profile.routing
from edu_project.middleware.ws_auth import TokenAuthMiddleware

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "edu_project.settings")
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter(
            ai.routing.websocket_urlpatterns
            + messaging.routing.websocket_urlpatterns
            + student_profile.routing.websocket_urlpatterns
        )
    ),
})
