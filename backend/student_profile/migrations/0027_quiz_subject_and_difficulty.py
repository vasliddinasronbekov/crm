from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('student_profile', '0026_paymenttype_catalog'),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='difficulty_level',
            field=models.CharField(
                choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')],
                default='medium',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='quiz',
            name='subject',
            field=models.CharField(
                choices=[
                    ('general', 'General'),
                    ('math', 'Mathematics'),
                    ('english', 'English'),
                    ('science', 'Science'),
                ],
                default='general',
                max_length=30,
            ),
        ),
        migrations.AddIndex(
            model_name='quiz',
            index=models.Index(
                fields=['subject', 'difficulty_level', 'is_published'],
                name='studprof_subj_diff_pub_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='quiz',
            index=models.Index(fields=['quiz_type'], name='studprof_quiz_type_idx'),
        ),
    ]
