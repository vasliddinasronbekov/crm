from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('student_profile', '0023_monthlysubscriptioncharge_final_charge_tiyin'),
    ]

    operations = [
        migrations.AddField(
            model_name='satattempt',
            name='current_module_key',
            field=models.CharField(default='rw_module1', max_length=20),
        ),
        migrations.AddField(
            model_name='satattempt',
            name='current_question_index',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='satattempt',
            name='last_state_synced_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='satattempt',
            name='module_time_remaining_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
