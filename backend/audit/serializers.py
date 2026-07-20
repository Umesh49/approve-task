from rest_framework import serializers
from audit.models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
