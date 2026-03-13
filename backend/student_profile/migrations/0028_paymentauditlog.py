from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('student_profile', '0027_quiz_subject_and_difficulty'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PaymentAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('payment_id_snapshot', models.PositiveBigIntegerField(db_index=True)),
                ('transaction_id_snapshot', models.CharField(blank=True, db_index=True, max_length=255)),
                ('event_type', models.CharField(choices=[('created', 'Created'), ('updated', 'Updated'), ('deleted', 'Deleted')], db_index=True, max_length=16)),
                ('changed_by_display', models.CharField(blank=True, max_length=255)),
                ('amount_before', models.BigIntegerField(blank=True, null=True)),
                ('amount_after', models.BigIntegerField(blank=True, null=True)),
                ('course_price_before', models.BigIntegerField(blank=True, null=True)),
                ('course_price_after', models.BigIntegerField(blank=True, null=True)),
                ('status_before', models.CharField(blank=True, max_length=20)),
                ('status_after', models.CharField(blank=True, max_length=20)),
                ('changed_fields', models.JSONField(blank=True, default=list)),
                ('previous_snapshot', models.JSONField(blank=True, default=dict)),
                ('new_snapshot', models.JSONField(blank=True, default=dict)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('source', models.CharField(default='api', max_length=64)),
                ('request_method', models.CharField(blank=True, max_length=16)),
                ('request_path', models.CharField(blank=True, max_length=255)),
                ('ip_address', models.CharField(blank=True, max_length=64)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('changed_by_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payment_audit_events', to=settings.AUTH_USER_MODEL)),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to='student_profile.payment')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(fields=['payment_id_snapshot', '-created_at'], name='pay_audit_payment_idx'),
                    models.Index(fields=['event_type', '-created_at'], name='pay_audit_event_idx'),
                ],
            },
        ),
    ]
