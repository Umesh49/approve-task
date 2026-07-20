import json
from django.core.serializers.json import DjangoJSONEncoder
from audit.models import AuditLog

def get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def make_json_safe(data):
    """
    Converts Python native objects (like UUIDs, datetimes) in a dictionary/list
    to JSON-serializable types using Django's JSON encoder.
    """
    if data is None:
        return None
    try:
        return json.loads(json.dumps(data, cls=DjangoJSONEncoder))
    except Exception:
        return None

def create_audit_log(user, action, entity_type, entity_id, old_value=None, new_value=None, request=None):
    ip_address = get_client_ip(request) if request else None
    user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''
    
    username = user.username if user and user.is_authenticated else 'System'
    
    entity_name = f"#{entity_id}"
    data_dict = new_value or old_value or {}
    if isinstance(data_dict, dict):
        if 'title' in data_dict and data_dict['title']:
            entity_name = f"'{data_dict['title']}'"
        elif 'name' in data_dict and data_dict['name']:
            entity_name = f"'{data_dict['name']}'"
            
    action_str = action.replace('_', ' ')
    type_str = entity_type.replace('_', ' ').title()
    
    description = f"{username} {action_str} {type_str} {entity_name}"

    return AuditLog.objects.create(
        user=user if user and user.is_authenticated else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        old_value=make_json_safe(old_value),
        new_value=make_json_safe(new_value),
        ip_address=ip_address,
        user_agent=user_agent
    )
