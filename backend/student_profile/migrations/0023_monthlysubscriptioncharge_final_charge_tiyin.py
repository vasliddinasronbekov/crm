from django.db import migrations, models
from django.db.models import F


def populate_final_charge_tiyin(apps, schema_editor):
    MonthlySubscriptionCharge = apps.get_model('student_profile', 'MonthlySubscriptionCharge')
    MonthlySubscriptionCharge.objects.all().update(
        final_charge_tiyin=F('charged_tiyin') - F('refunded_tiyin')
    )


def reverse_final_charge_tiyin(apps, schema_editor):
    MonthlySubscriptionCharge = apps.get_model('student_profile', 'MonthlySubscriptionCharge')
    MonthlySubscriptionCharge.objects.all().update(final_charge_tiyin=0)


class Migration(migrations.Migration):

    dependencies = [
        ('student_profile', '0022_student_account_and_attendance_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='monthlysubscriptioncharge',
            name='final_charge_tiyin',
            field=models.BigIntegerField(
                default=0,
                help_text='Final charge after attendance-based settlements in tiyin',
            ),
        ),
        migrations.RunPython(populate_final_charge_tiyin, reverse_final_charge_tiyin),
    ]
