# messaging/ws_auth.py
import jwt
from django.conf import settings
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from urllib.parse import parse_qs

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        return User.objects.get(id=user_id)
    except Exception:
        return None

class TokenAuthMiddleware:
    """
    Token auth middleware for Channels 3
    Usage: Token in query param ?token=... or in Sec-WebSocket-Protocol header handled in frontend.
    """
    def __init__(self, inner):
        self.inner = inner

    def __call__(self, scope):
        return TokenAuthMiddlewareInstance(scope, self)

class TokenAuthMiddlewareInstance:
    def __init__(self, scope, middleware):
        self.scope = dict(scope)
        self.inner = middleware.inner

    async def __call__(self, receive, send):
        query_string = self.scope.get("query_string", b"").decode()
        qs = parse_qs(query_string)
        token = qs.get("token", [None])[0]
        if token:
            user = await get_user_from_token(token)
            if user:
                self.scope["user"] = user
        inner = self.inner(self.scope)
        return await inner(receive, send)
