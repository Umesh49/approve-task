from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from accounts.models import User
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

@database_sync_to_async
def get_user_from_token(token_string):
    try:
        access_token = AccessToken(token_string)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom WebSocket middleware to authenticate users using JWT in query parameters (?token=...).
    """
    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token')
        
        if token:
            scope['user'] = await get_user_from_token(token[0])
        else:
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)
