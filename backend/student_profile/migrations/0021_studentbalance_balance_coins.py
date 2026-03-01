from django.db import migrations, models


def populate_balance_coins(apps, schema_editor):
    StudentBalance = apps.get_model('student_profile', 'StudentBalance')
    for balance in StudentBalance.objects.all().iterator():
        balance.balance_coins = (balance.balance or 0) * 100
        balance.save(update_fields=['balance_coins'])


def reverse_balance_coins(apps, schema_editor):
    StudentBalance = apps.get_model('student_profile', 'StudentBalance')
    StudentBalance.objects.all().update(balance_coins=0)


class Migration(migrations.Migration):

    dependencies = [
        ('student_profile', '0020_alter_accounttransaction_transaction_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentbalance',
            name='balance_coins',
            field=models.BigIntegerField(default=0, help_text='Remaining balance in coins (1 UZS = 10,000 coins)'),
        ),
        migrations.RunPython(populate_balance_coins, reverse_balance_coins),
    ]
