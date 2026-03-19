from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('student_profile', '0029_attendancecharge_companyshareentry_and_more'),
        ('task', '0004_certificate_template'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='certificatetemplate',
            name='branch',
            field=models.ForeignKey(
                blank=True,
                help_text='Template ownership scope. Null means global template.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='certificate_templates',
                to='student_profile.branch',
            ),
        ),
        migrations.AddField(
            model_name='certificatetemplate',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_certificate_templates',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
