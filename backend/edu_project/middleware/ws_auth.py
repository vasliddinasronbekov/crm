import jwt
from django.conf import settings
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
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
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        ws_scope = dict(scope)
        query_string = ws_scope.get("query_string", b"").decode()
        qs = parse_qs(query_string)
        token = qs.get("token", [None])[0]

        ws_scope["user"] = AnonymousUser()
        if token:
            user = await get_user_from_token(token)
            if user:
                ws_scope["user"] = user

        return await self.app(ws_scope, receive, send)
