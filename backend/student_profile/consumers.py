from channels.generic.websocket import AsyncJsonWebsocketConsumer


class AccountingLogConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or getattr(user, 'is_anonymous', True):
            await self.close(code=4401)
            return

        self.group_names = []
        if user.is_superuser or user.is_staff:
            self.group_names.append('accounting_logs_admin')
        elif user.is_teacher:
            self.group_names.append(f'accounting_logs_teacher_{user.id}')
        else:
            self.group_names.append(f'accounting_logs_student_{user.id}')

        for group_name in self.group_names:
            await self.channel_layer.group_add(group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        for group_name in getattr(self, 'group_names', []):
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    async def accounting_log_event(self, event):
        await self.send_json({
            'type': 'accounting_log',
            'payload': event.get('payload', {}),
        })
