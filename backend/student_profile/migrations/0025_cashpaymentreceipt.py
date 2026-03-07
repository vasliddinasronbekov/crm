from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('student_profile', '0024_satattempt_runtime_state'),
    ]

    operations = [
        migrations.CreateModel(
            name='CashPaymentReceipt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('receipt_number', models.CharField(db_index=True, max_length=64, unique=True)),
                ('receipt_token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('issued_at', models.DateTimeField(auto_now_add=True)),
                ('education_center_name', models.CharField(max_length=255)),
                ('branch_name', models.CharField(blank=True, max_length=255)),
                ('cashier_full_name', models.CharField(blank=True, max_length=255)),
                ('student_full_name', models.CharField(max_length=255)),
                ('group_name', models.CharField(blank=True, max_length=255)),
                ('course_service_name', models.CharField(blank=True, max_length=255)),
                ('payment_method', models.CharField(default='cash', max_length=32)),
                ('paid_amount', models.BigIntegerField(help_text="To'langan summa tiyinlarda")),
                ('remaining_balance', models.BigIntegerField(default=0, help_text='Qolgan balans tiyinlarda')),
                ('note', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('payment', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='cash_receipt', to='student_profile.payment')),
            ],
            options={
                'ordering': ['-issued_at'],
            },
        ),
    ]

