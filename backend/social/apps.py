from django.apps import AppConfig


class SocialConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'social'
    verbose_name = 'Social Learning'

    def ready(self):
        """Import signal handlers when Django starts"""
        import social.signals  # noqa
