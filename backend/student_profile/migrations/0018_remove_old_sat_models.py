# Generated manually to remove old SAT models before adding SAT 2025

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('student_profile', '0017_ieltsexamdraft_aiexamgenerationrequest_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='SATAttempt',
        ),
        migrations.DeleteModel(
            name='SATSection',
        ),
        migrations.DeleteModel(
            name='SATTest',
        ),
    ]
