"""
Django migration for Report Scheduling and Payment Reminders models
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('student_profile', '0008_add_account_transaction'),
    ]

    operations = [
        # ScheduledReport model
        migrations.CreateModel(
            name='ScheduledReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('report_type', models.CharField(choices=[
                    ('attendance', 'Student Attendance Report'),
                    ('enrollment', 'Course Enrollment Report'),
                    ('performance', 'Performance Analytics'),
                    ('revenue', 'Revenue by Course'),
                    ('lead_conversion', 'Lead Conversion Report'),
                    ('profit_loss', 'Profit & Loss Statement'),
                    ('cash_flow', 'Cash Flow Statement'),
                    ('accounts_receivable', 'Accounts Receivable Report'),
                    ('teacher_compensation', 'Teacher Compensation Report'),
                    ('custom', 'Custom Report'),
                ], max_length=50)),
                ('frequency', models.CharField(choices=[
                    ('daily', 'Daily'),
                    ('weekly', 'Weekly'),
                    ('monthly', 'Monthly'),
                ], max_length=20)),
                ('day_of_week', models.CharField(blank=True, choices=[
                    ('monday', 'Monday'),
                    ('tuesday', 'Tuesday'),
                    ('wednesday', 'Wednesday'),
                    ('thursday', 'Thursday'),
                    ('friday', 'Friday'),
                    ('saturday', 'Saturday'),
                    ('sunday', 'Sunday'),
                ], help_text='Required for weekly reports', max_length=20, null=True)),
                ('time', models.TimeField(help_text='Time to generate report (24-hour format)')),
                ('recipients', models.TextField(help_text='Comma-separated email addresses')),
                ('enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_run', models.DateTimeField(blank=True, null=True)),
                ('next_run', models.DateTimeField(blank=True, null=True)),
                ('parameters', models.JSONField(blank=True, default=dict, help_text='Additional parameters for report generation')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_scheduled_reports', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'scheduled_reports',
                'ordering': ['-created_at'],
            },
        ),

        # ReportGeneration model
        migrations.CreateModel(
            name='ReportGeneration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('report_type', models.CharField(max_length=50)),
                ('status', models.CharField(choices=[
                    ('pending', 'Pending'),
                    ('processing', 'Processing'),
                    ('completed', 'Completed'),
                    ('failed', 'Failed'),
                ], default='pending', max_length=20)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('file_path', models.CharField(blank=True, max_length=500)),
                ('file_url', models.URLField(blank=True, max_length=500)),
                ('error_message', models.TextField(blank=True)),
                ('parameters', models.JSONField(blank=True, default=dict)),
                ('result_data', models.JSONField(blank=True, default=dict)),
                ('scheduled_report', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='generations', to='student_profile.scheduledreport')),
            ],
            options={
                'db_table': 'report_generations',
                'ordering': ['-started_at'],
            },
        ),

        # PaymentReminderSettings model
        migrations.CreateModel(
            name='PaymentReminderSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False)),
                ('days_before_due', models.IntegerField(default=3, help_text='Send reminder X days before payment due date')),
                ('frequency', models.CharField(choices=[
                    ('daily', 'Daily'),
                    ('weekly', 'Weekly'),
                    ('biweekly', 'Bi-weekly'),
                ], default='daily', max_length=20)),
                ('email_template', models.CharField(choices=[
                    ('default', 'Default Template'),
                    ('friendly', 'Friendly Reminder'),
                    ('urgent', 'Urgent Notice'),
                    ('final', 'Final Notice'),
                ], default='default', max_length=20)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reminder_settings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'payment_reminder_settings',
                'verbose_name': 'Payment Reminder Settings',
                'verbose_name_plural': 'Payment Reminder Settings',
            },
        ),

        # PaymentReminder model
        migrations.CreateModel(
            name='PaymentReminder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recipient_email', models.EmailField(max_length=254)),
                ('template_used', models.CharField(default='default', max_length=20)),
                ('status', models.CharField(choices=[
                    ('pending', 'Pending'),
                    ('sent', 'Sent'),
                    ('failed', 'Failed'),
                    ('bounced', 'Bounced'),
                ], default='pending', max_length=20)),
                ('scheduled_at', models.DateTimeField(auto_now_add=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('email_provider_id', models.CharField(blank=True, max_length=200)),
                ('error_message', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('payment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reminders', to='student_profile.payment')),
            ],
            options={
                'db_table': 'payment_reminders',
                'ordering': ['-scheduled_at'],
            },
        ),

        # Add indexes
        migrations.AddIndex(
            model_name='scheduledreport',
            index=models.Index(fields=['enabled', 'next_run'], name='scheduled_r_enabled_idx'),
        ),
        migrations.AddIndex(
            model_name='scheduledreport',
            index=models.Index(fields=['report_type'], name='scheduled_r_report_t_idx'),
        ),
        migrations.AddIndex(
            model_name='reportgeneration',
            index=models.Index(fields=['status', 'started_at'], name='report_gen_status_idx'),
        ),
        migrations.AddIndex(
            model_name='paymentreminder',
            index=models.Index(fields=['status', 'scheduled_at'], name='payment_re_status_idx'),
        ),
        migrations.AddIndex(
            model_name='paymentreminder',
            index=models.Index(fields=['payment', 'status'], name='payment_re_payment_idx'),
        ),
    ]
