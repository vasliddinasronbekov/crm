# task/models.py
from django.db import models
from users.models import User # O'zimizning User modelimiz

# Enums
class When(models.IntegerChoices):
    EVERY_DAY = 1, "every day"
    EVERY_WEEK = 2, "every week"
    EVERY_MONTH = 3, "every month"

class WeekDay(models.IntegerChoices):
    MONDAY = 1, "Monday"
    TUESDAY = 2, "Tuesday"
    WEDNESDAY = 3, "Wednesday"
    THURSDAY = 4, "Thursday"
    FRIDAY = 5, "Friday"
    SATURDAY = 6, "Saturday"
    SUNDAY = 7, "Sunday"

class ListStatus(models.IntegerChoices):
    FAOL = 1, "faol"
    OTHER = 2, "other"
    DONE = 3, "done"

class Board(models.Model):
    name = models.CharField(max_length=255)
    # db_index=True - bu maydon bo'yicha qidiruvlarni tezlashtiradi
    users = models.ManyToManyField(User, related_name='task_boards')
    teachers = models.ManyToManyField(User, related_name='teaching_boards', limit_choices_to={'is_teacher': True})

    def __str__(self):
        return self.name

class List(models.Model):
    name = models.CharField(max_length=255)
    order = models.BigIntegerField(default=0) # Spetsifikatsiyadagi '9223372036854776000' BigIntegerField ga mos keladi
    board = models.ForeignKey(Board, related_name='lists', on_delete=models.CASCADE, db_index=True)
    color = models.CharField(max_length=50, blank=True, null=True)
    status = models.IntegerField(choices=ListStatus.choices, default=ListStatus.FAOL)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} on {self.board.name}"

class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks', db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    response = models.TextField(blank=True, null=True)
    is_done = models.BooleanField(default=False)
    due_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    view_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    list = models.ForeignKey(List, on_delete=models.CASCADE, related_name='tasks', db_index=True)

    def __str__(self):
        return self.title

class AutoTask(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    when = models.IntegerField(choices=When.choices)
    week_day = models.IntegerField(choices=WeekDay.choices, blank=True, null=True)
    month_day = models.BigIntegerField(blank=True, null=True)
    hour = models.TimeField()
    deadline_day = models.BigIntegerField()
    deadline_hour = models.TimeField()
    list = models.ForeignKey(List, on_delete=models.CASCADE, related_name='autotasks')
    users = models.ManyToManyField(User, related_name='autotasks')

    def __str__(self):
        return f"AutoTask: {self.title}"
# Import certificate models
from .certificate_models import Certificate, CertificateTemplate, CertificateVerification
