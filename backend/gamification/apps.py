from django.apps import AppConfig


class GamificationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'gamification'
    verbose_name = 'Gamification System'

    def ready(self):
        import gamification.signals
