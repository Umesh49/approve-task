from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """
    Allows access only to users with the 'admin' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class IsApprover(permissions.BasePermission):
    """
    Allows access only to users with the 'approver' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'approver')

class IsRequester(permissions.BasePermission):
    """
    Allows access only to users with the 'requester' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'requester')

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access to authenticated users, and write access only to admins.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Allows access to the owner of the object (via submitted_by, created_by, or user) or to admins.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'admin':
            return True
        
        for field in ['submitted_by', 'created_by', 'user']:
            if hasattr(obj, field) and getattr(obj, field) == request.user:
                return True
        return False
