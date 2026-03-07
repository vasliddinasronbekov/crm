from django.db import migrations, models


DEFAULT_PAYMENT_TYPES = [
    {'code': 'cash', 'name': 'Cash', 'display_order': 10},
    {'code': 'click', 'name': 'Click', 'display_order': 20},
    {'code': 'payme', 'name': 'Payme', 'display_order': 30},
    {'code': 'stripe', 'name': 'Stripe', 'display_order': 40},
    {'code': 'bank_transfer', 'name': 'Bank Transfer', 'display_order': 50},
    {'code': 'card_terminal', 'name': 'Card Terminal', 'display_order': 60},
]

PAYMENT_TYPE_CODE_ALIASES = {
    'cash': {'cash', 'naqd', 'наличные', 'нал'},
    'click': {'click'},
    'payme': {'payme', 'pay me'},
    'stripe': {'stripe'},
    'bank_transfer': {'bank transfer', 'wire transfer', 'transfer'},
    'card_terminal': {'card terminal', 'pos', 'terminal'},
}


def _normalize_name(value):
    return (value or '').strip().lower()


def seed_payment_types(apps, schema_editor):
    PaymentType = apps.get_model('student_profile', 'PaymentType')

    # First map existing rows by fuzzy aliases
    existing = list(PaymentType.objects.all())
    for row in existing:
        normalized_name = _normalize_name(row.name)
        for code, aliases in PAYMENT_TYPE_CODE_ALIASES.items():
            if normalized_name in aliases and not row.code:
                row.code = code
                row.save(update_fields=['code'])
                break

    # Ensure canonical defaults exist
    for payload in DEFAULT_PAYMENT_TYPES:
        obj = PaymentType.objects.filter(code=payload['code']).first()
        if obj:
            changed = False
            if obj.name != payload['name']:
                obj.name = payload['name']
                changed = True
            if obj.display_order != payload['display_order']:
                obj.display_order = payload['display_order']
                changed = True
            if not obj.is_active:
                obj.is_active = True
                changed = True
            if changed:
                obj.save(update_fields=['name', 'display_order', 'is_active'])
            continue

        name_match = PaymentType.objects.filter(name__iexact=payload['name']).first()
        if name_match:
            changed = False
            if name_match.code != payload['code']:
                name_match.code = payload['code']
                changed = True
            if name_match.display_order != payload['display_order']:
                name_match.display_order = payload['display_order']
                changed = True
            if not name_match.is_active:
                name_match.is_active = True
                changed = True
            if changed:
                name_match.save(update_fields=['code', 'display_order', 'is_active'])
            continue

        PaymentType.objects.create(
            code=payload['code'],
            name=payload['name'],
            display_order=payload['display_order'],
            is_active=True,
        )


class Migration(migrations.Migration):
    dependencies = [
        ('student_profile', '0025_cashpaymentreceipt'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymenttype',
            name='code',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='paymenttype',
            name='display_order',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='paymenttype',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterModelOptions(
            name='paymenttype',
            options={'ordering': ['display_order', 'name']},
        ),
        migrations.RunPython(seed_payment_types, migrations.RunPython.noop),
    ]

