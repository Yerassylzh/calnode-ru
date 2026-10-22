// Catalog for the settingsNotifications module. Keys MUST be prefixed with "settingsNotifications."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsNotifications.loadFailed': 'Could not load preferences',
	'settingsNotifications.saved': 'Preferences saved',
	'settingsNotifications.saveFailed': 'Could not save preferences',
	'settingsNotifications.title': 'Notifications',
	'settingsNotifications.description':
		'Control which emails you and your attendees receive.',
	'settingsNotifications.attendeeSection': 'Emails sent to your attendees',
	'settingsNotifications.bookingConfirmation': 'Booking confirmation',
	'settingsNotifications.cancellationNotice': 'Cancellation notice',
	'settingsNotifications.rescheduleNotice': 'Reschedule notice',
	'settingsNotifications.reminderEmails': 'Reminder emails',
	'settingsNotifications.hostSection': 'Emails sent to you',
	'settingsNotifications.hostBooking': 'New booking received',
	'settingsNotifications.hostCancel': 'Booking cancelled',
	'settingsNotifications.hostReschedule': 'Booking rescheduled'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsNotifications.loadFailed': 'Не удалось загрузить настройки',
	'settingsNotifications.saved': 'Настройки сохранены',
	'settingsNotifications.saveFailed': 'Не удалось сохранить настройки',
	'settingsNotifications.title': 'Уведомления',
	'settingsNotifications.description':
		'Управляйте тем, какие письма получаете вы и ваши участники.',
	'settingsNotifications.attendeeSection': 'Письма участникам',
	'settingsNotifications.bookingConfirmation': 'Подтверждение бронирования',
	'settingsNotifications.cancellationNotice': 'Уведомление об отмене',
	'settingsNotifications.rescheduleNotice': 'Уведомление о переносе',
	'settingsNotifications.reminderEmails': 'Напоминания',
	'settingsNotifications.hostSection': 'Письма вам',
	'settingsNotifications.hostBooking': 'Получено новое бронирование',
	'settingsNotifications.hostCancel': 'Бронирование отменено',
	'settingsNotifications.hostReschedule': 'Бронирование перенесено'
};
