from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from workflows.models import Workflow, WorkflowStage, Rule, WorkflowVersion

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with default users and a sample workflow'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting database seeding...")

        # 1. Create Users
        admin, created = User.objects.get_or_create(username='admin', defaults={'email': 'admin@spinach.com', 'role': 'admin'})
        if created:
            admin.set_password('admin123')
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()
            self.stdout.write(self.style.SUCCESS("Created admin user (admin / admin123)"))

        approver, created = User.objects.get_or_create(username='manager', defaults={'email': 'manager@spinach.com', 'role': 'approver'})
        if created:
            approver.set_password('manager123')
            approver.save()
            self.stdout.write(self.style.SUCCESS("Created approver user (manager / manager123)"))

        requester, created = User.objects.get_or_create(username='employee', defaults={'email': 'employee@spinach.com', 'role': 'requester'})
        if created:
            requester.set_password('employee123')
            requester.save()
            self.stdout.write(self.style.SUCCESS("Created requester user (employee / employee123)"))

        # 2. Create Workflow
        workflow, wf_created = Workflow.objects.get_or_create(
            name='Standard Expense Approval',
            defaults={
                'description': 'A sample 2-stage approval workflow for expenses.',
                'current_version': 1,
                'is_published': True,
                'created_by': admin
            }
        )

        if wf_created:
            # Stage 1: Department Manager
            stage1 = WorkflowStage.objects.create(
                workflow=workflow,
                name='Department Review',
                order=1,
                approver_role='approver',
                specific_approver=approver
            )

            # Stage 2: Finance
            stage2 = WorkflowStage.objects.create(
                workflow=workflow,
                name='Finance Final Review',
                order=2,
                approver_role='admin',
                specific_approver=admin
            )

            # Rule: If amount < 1000, skip Finance Review
            Rule.objects.create(
                workflow=workflow,
                stage=stage2,
                field_name='amount',
                operator='lt',
                value='1000',
                action='skip_stage',
                order=1
            )

            # Snapshot the version
            WorkflowVersion.objects.create(
                workflow=workflow,
                version_number=1,
                snapshot={
                    "stages": [{"id": str(stage1.id), "name": stage1.name, "approver_role": "approver", "specific_approver_id": str(approver.id)}, 
                               {"id": str(stage2.id), "name": stage2.name, "approver_role": "admin", "specific_approver_id": str(admin.id)}],
                    "rules": [{"field_name": "amount", "operator": "lt", "value": "1000", "action": "skip_stage", "stage_id": str(stage2.id)}]
                },
                changelog="Initial seed version",
                published_by=admin
            )
            
            self.stdout.write(self.style.SUCCESS("Created sample workflow 'Standard Expense Approval'"))

        self.stdout.write(self.style.SUCCESS("Database seeding completed!"))
