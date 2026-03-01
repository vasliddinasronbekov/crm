from django.apps import AppConfig


class StudentProfileConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'student_profile'

    def ready(self):
        """
        Import signals when app is ready.
        This enables automatic accounting features.
        """
        import student_profile.signals  # noqa
