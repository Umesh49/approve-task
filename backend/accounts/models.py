import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager

class CustomUserManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(username, email, password, **extra_fields)

class User(AbstractUser):
    ROLE_ADMIN = 'admin'
    ROLE_APPROVER = 'approver'
    ROLE_REQUESTER = 'requester'

    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_APPROVER, 'Approver'),
        (ROLE_REQUESTER, 'Requester'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_REQUESTER)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"
