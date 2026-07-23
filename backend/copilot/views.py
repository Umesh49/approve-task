from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from copilot.services import GroqService

class ChatViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def generate(self, request):
        message = request.data.get('message')
        history = request.data.get('history', [])
        
        if not message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        service = GroqService()
        response_data = service.generate_chat_response(message, request.user, history)
        
        if response_data.get("type") == "error":
            return Response({"error": response_data.get("message")}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response(response_data, status=status.HTTP_200_OK)
