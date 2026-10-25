// Catalog for the webhooks module. Keys MUST be prefixed with "webhooks."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	"webhooks.fields.attendeePhone": "Attendee phone number",
	"webhooks.fields.contactMethod": "Primary contact method",
	'webhooks.pageTitle': 'Webhooks — Calnode',
	'webhooks.heading': 'Webhooks',
	'webhooks.subtitle': 'Receive real-time notifications for booking events.',
	'webhooks.newWebhook': 'New webhook',

	'webhooks.dialog.title': 'Delete webhook?',
	'webhooks.dialog.description': 'The endpoint will stop receiving events immediately.',

	'webhooks.form.urlLabel': 'Endpoint URL',
	'webhooks.form.eventsHeading': 'Events to send',
	'webhooks.form.dataHeading': 'Data to send',
	'webhooks.form.dataHint': "— untick anything you don't want delivered",
	'webhooks.form.piiTag': '· personal data',
	'webhooks.form.creating': 'Creating…',
	'webhooks.form.create': 'Create webhook',

	'webhooks.errors.urlRequired': 'URL is required.',
	'webhooks.errors.urlHttps': 'URL must start with https://',
	'webhooks.errors.noEvents': 'Select at least one event.',

	'webhooks.groups.booking': 'Booking',
	'webhooks.groups.payment': 'Payment',
	'webhooks.groups.eventType': 'Event type',
	'webhooks.groups.host': 'Host',
	'webhooks.groups.attendee': 'Attendee',
	'webhooks.groups.intake': 'Intake',

	'webhooks.fields.bookingRef': 'Booking reference',
	'webhooks.fields.status': 'Status',
	'webhooks.fields.startAt': 'Start time',
	'webhooks.fields.endAt': 'End time',
	'webhooks.fields.createdAt': 'Created at',
	'webhooks.fields.location': 'Location',
	'webhooks.fields.cancellationReason': 'Cancellation reason',
	'webhooks.fields.previousStart': 'Previous start (reschedule)',
	'webhooks.fields.previousEnd': 'Previous end (reschedule)',
	'webhooks.fields.rsvpStatus': 'RSVP answer (booking.rsvp)',
	'webhooks.fields.paymentStatus': 'Payment status',
	'webhooks.fields.amountPaidCents': 'Amount paid (cents)',
	'webhooks.fields.amountPaidCurrency': 'Currency',
	'webhooks.fields.eventTypeSlug': 'Event type slug',
	'webhooks.fields.eventTypeName': 'Event type name',
	'webhooks.fields.hostId': 'Host ID',
	'webhooks.fields.hostName': 'Host name',
	'webhooks.fields.hostEmail': 'Host email',
	'webhooks.fields.attendeeName': 'Attendee name',
	'webhooks.fields.attendeeEmail': 'Attendee email',
	'webhooks.fields.attendeeTimezone': 'Attendee timezone',
	'webhooks.fields.intakeAnswers': 'Intake answers',

	'webhooks.empty.title': 'No webhooks',
	'webhooks.empty.description':
		'Add a webhook to receive real-time notifications for booking events.',

	'webhooks.table.url': 'URL',
	'webhooks.table.events': 'Events',
	'webhooks.table.fields': 'Fields',
	'webhooks.table.status': 'Status',
	'webhooks.table.created': 'Created',
	'webhooks.table.fieldsCount': { one: '{count} field', other: '{count} fields' },

	'webhooks.status.active': 'Active',
	'webhooks.status.inactive': 'Inactive',

	'webhooks.deleteAction': 'Delete webhook',

	'webhooks.deliveries.hide': 'Hide deliveries',
	'webhooks.deliveries.recent': 'Recent deliveries',
	'webhooks.deliveries.loading': 'Loading deliveries…',
	'webhooks.deliveries.none': 'No deliveries yet for this webhook.',
	'webhooks.deliveries.event': 'Event',
	'webhooks.deliveries.status': 'Status',
	'webhooks.deliveries.http': 'HTTP',
	'webhooks.deliveries.attempts': 'Attempts',
	'webhooks.deliveries.lastAttempt': 'Last attempt'
};

export const ru: Record<string, CatalogEntry> = {
	"webhooks.fields.attendeePhone": "Телефон посетителя",
	"webhooks.fields.contactMethod": "Основной способ связи",
	'webhooks.pageTitle': 'Вебхуки — Calnode',
	'webhooks.heading': 'Вебхуки',
	'webhooks.subtitle': 'Получайте уведомления о событиях бронирования в реальном времени.',
	'webhooks.newWebhook': 'Новый вебхук',

	'webhooks.dialog.title': 'Удалить вебхук?',
	'webhooks.dialog.description': 'Конечная точка немедленно прекратит получать события.',

	'webhooks.form.urlLabel': 'URL-адрес конечной точки',
	'webhooks.form.eventsHeading': 'Отправляемые события',
	'webhooks.form.dataHeading': 'Отправляемые данные',
	'webhooks.form.dataHint': '— снимите флажки для всего, что не нужно передавать',
	'webhooks.form.piiTag': '· персональные данные',
	'webhooks.form.creating': 'Создание…',
	'webhooks.form.create': 'Создать вебхук',

	'webhooks.errors.urlRequired': 'Укажите URL-адрес.',
	'webhooks.errors.urlHttps': 'URL-адрес должен начинаться с https://',
	'webhooks.errors.noEvents': 'Выберите хотя бы одно событие.',

	'webhooks.groups.booking': 'Бронирование',
	'webhooks.groups.payment': 'Оплата',
	'webhooks.groups.eventType': 'Тип события',
	'webhooks.groups.host': 'Организатор',
	'webhooks.groups.attendee': 'Участник',
	'webhooks.groups.intake': 'Анкета',

	'webhooks.fields.bookingRef': 'Номер бронирования',
	'webhooks.fields.status': 'Статус',
	'webhooks.fields.startAt': 'Время начала',
	'webhooks.fields.endAt': 'Время окончания',
	'webhooks.fields.createdAt': 'Время создания',
	'webhooks.fields.location': 'Место',
	'webhooks.fields.cancellationReason': 'Причина отмены',
	'webhooks.fields.previousStart': 'Прежнее время начала (при переносе)',
	'webhooks.fields.previousEnd': 'Прежнее время окончания (при переносе)',
	'webhooks.fields.rsvpStatus': 'Ответ RSVP (booking.rsvp)',
	'webhooks.fields.paymentStatus': 'Статус оплаты',
	'webhooks.fields.amountPaidCents': 'Оплаченная сумма (в центах)',
	'webhooks.fields.amountPaidCurrency': 'Валюта',
	'webhooks.fields.eventTypeSlug': 'Слаг типа события',
	'webhooks.fields.eventTypeName': 'Название типа события',
	'webhooks.fields.hostId': 'ID организатора',
	'webhooks.fields.hostName': 'Имя организатора',
	'webhooks.fields.hostEmail': 'Email организатора',
	'webhooks.fields.attendeeName': 'Имя участника',
	'webhooks.fields.attendeeEmail': 'Email участника',
	'webhooks.fields.attendeeTimezone': 'Часовой пояс участника',
	'webhooks.fields.intakeAnswers': 'Ответы анкеты',

	'webhooks.empty.title': 'Нет вебхуков',
	'webhooks.empty.description':
		'Добавьте вебхук, чтобы получать уведомления о событиях бронирования в реальном времени.',

	'webhooks.table.url': 'URL',
	'webhooks.table.events': 'События',
	'webhooks.table.fields': 'Поля',
	'webhooks.table.status': 'Статус',
	'webhooks.table.created': 'Создан',
	'webhooks.table.fieldsCount': { one: '{count} поле', few: '{count} поля', many: '{count} полей', other: '{count} полей' },

	'webhooks.status.active': 'Активен',
	'webhooks.status.inactive': 'Неактивен',

	'webhooks.deleteAction': 'Удалить вебхук',

	'webhooks.deliveries.hide': 'Скрыть доставки',
	'webhooks.deliveries.recent': 'Последние доставки',
	'webhooks.deliveries.loading': 'Загрузка доставок…',
	'webhooks.deliveries.none': 'Для этого вебхука пока нет доставок.',
	'webhooks.deliveries.event': 'Событие',
	'webhooks.deliveries.status': 'Статус',
	'webhooks.deliveries.http': 'HTTP',
	'webhooks.deliveries.attempts': 'Попытки',
	'webhooks.deliveries.lastAttempt': 'Последняя попытка'
};
