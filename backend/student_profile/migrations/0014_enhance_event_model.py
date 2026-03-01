# Generated manually for Event model enhancements

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('student_profile', '0013_cefrlevel_course_created_at_course_description_and_more'),
    ]

    operations = [
        # Rename time to start_time (keeping db column name for backward compatibility)
        migrations.RenameField(
            model_name='event',
            old_name='time',
            new_name='start_time',
        ),

        # Add new fields
        migrations.AddField(
            model_name='event',
            name='description',
            field=models.TextField(blank=True, help_text='Detailed event description'),
        ),
        migrations.AddField(
            model_name='event',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('assignment', 'Assignment'),
                    ('exam', 'Exam'),
                    ('quiz', 'Quiz'),
                    ('meeting', 'Meeting'),
                    ('holiday', 'Holiday'),
                    ('class', 'Class Session'),
                    ('announcement', 'Announcement'),
                    ('other', 'Other'),
                ],
                default='other',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='end_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='event',
            name='is_all_day',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='event',
            name='location',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='event',
            name='course',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='events',
                to='student_profile.course'
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='group',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='events',
                to='student_profile.group'
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_events',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='color',
            field=models.CharField(
                default='#3b82f6',
                help_text='Hex color for calendar display',
                max_length=7
            ),
        ),

        # Modify existing fields
        migrations.AlterField(
            model_name='event',
            name='students',
            field=models.ManyToManyField(
                blank=True,
                related_name='events',
                to=settings.AUTH_USER_MODEL
            ),
        ),

        # Add Meta options
        migrations.AlterModelOptions(
            name='event',
            options={'ordering': ['-start_time']},
        ),

        # Add indexes
        migrations.AddIndex(
            model_name='event',
            index=models.Index(fields=['start_time', 'event_type'], name='student_pr_start_t_idx'),
        ),
        migrations.AddIndex(
            model_name='event',
            index=models.Index(fields=['group', 'start_time'], name='student_pr_group_i_idx'),
        ),
    ]
