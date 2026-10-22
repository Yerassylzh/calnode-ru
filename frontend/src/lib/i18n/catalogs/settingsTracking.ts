// Catalog for the settingsTracking module. Keys MUST be prefixed with "settingsTracking."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsTracking.loadFailed': 'Could not load tracking settings',
	'settingsTracking.saved': 'Tracking settings saved',
	'settingsTracking.saveFailed': 'Could not save tracking settings',
	'settingsTracking.adminRequired': 'Admin access required.',
	'settingsTracking.googleTitle': 'Google Analytics & Tag Manager',
	'settingsTracking.googleDescription':
		"Enter an ID and Calnode loads the official tag on your booking page automatically — no snippet to paste, and the page's CSP is handled for you. Leave a field blank to turn that tag off.",
	'settingsTracking.gtmLabel': 'GTM Container ID',
	'settingsTracking.gtmHint':
		'Recommended — manages GA4 + Ads tags. Trigger them on the {event} dataLayer event below.',
	'settingsTracking.ga4Label': 'GA4 Measurement ID',
	'settingsTracking.ga4Hint':
		'Loads GA4 directly. Bookings fire a {purchase} / {lead} event with revenue.',
	'settingsTracking.injectionTitle': 'Code injection (head)',
	'settingsTracking.injectionDescription':
		'Raw HTML/JS injected into the <head> of your public booking and manage pages — for any tag not covered above (Meta Pixel, Plausible, custom). It runs on visitors’ browsers; only admins can set it.',
	'settingsTracking.headLabel': '<head> HTML',
	'settingsTracking.headPlaceholder':
		'<!-- Paste your GTM / GA4 / Meta Pixel snippet here -->',
	'settingsTracking.allowedOrigins': 'Allowed origins',
	'settingsTracking.allowedOriginsHint':
		'Leave blank to allow any https: origin while injection is active — simplest, and GTM-managed tags just work. Fill in to lock the page’s CSP to only these origins (space-separated); tags from other domains will then be blocked.',
	'settingsTracking.dataLayerTitle': 'dataLayer events',
	'settingsTracking.dataLayerDescription':
		'Push {events} into window.dataLayer so GTM can trigger on them.',
	'settingsTracking.fieldsHint':
		'Fields to include — untick anything you don’t want exposed to the browser / GTM.',
	'settingsTracking.fields.booking_id': 'Booking reference',
	'settingsTracking.fields.event_type_slug': 'Event type slug',
	'settingsTracking.fields.event_type_name': 'Event type name',
	'settingsTracking.fields.start_at': 'Start time',
	'settingsTracking.fields.end_at': 'End time',
	'settingsTracking.fields.status': 'Status',
	'settingsTracking.fields.location': 'Location',
	'settingsTracking.fields.host_name': 'Host name',
	'settingsTracking.fields.attendee_name': 'Attendee name',
	'settingsTracking.fields.attendee_email': 'Attendee email',
	'settingsTracking.fields.attendee_timezone': 'Attendee timezone',
	'settingsTracking.fields.answers': 'Intake answers',
	'settingsTracking.fields.value': 'Revenue / amount',
	'settingsTracking.fields.currency': 'Currency',
	'settingsTracking.fields.is_paid': 'Paid flag',
	'settingsTracking.fields.transaction_id': 'Transaction ID'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsTracking.loadFailed': 'Не удалось загрузить настройки аналитики',
	'settingsTracking.saved': 'Настройки аналитики сохранены',
	'settingsTracking.saveFailed': 'Не удалось сохранить настройки аналитики',
	'settingsTracking.adminRequired': 'Требуется доступ администратора.',
	'settingsTracking.googleTitle': 'Google Analytics и Tag Manager',
	'settingsTracking.googleDescription':
		'Укажите идентификатор, и Calnode автоматически загрузит официальный тег на страницу бронирования — без вставки скриптов, с автоматической настройкой CSP. Оставьте поле пустым, чтобы отключить тег.',
	'settingsTracking.gtmLabel': 'Идентификатор контейнера GTM',
	'settingsTracking.gtmHint':
		'Рекомендуется: управляет тегами GA4 и Google Рекламы. Активируйте их по событию {event} в dataLayer ниже.',
	'settingsTracking.ga4Label': 'Идентификатор потока данных GA4',
	'settingsTracking.ga4Hint':
		'Загружает GA4 напрямую. При бронировании отправляется событие {purchase} или {lead} с указанием дохода.',
	'settingsTracking.injectionTitle': 'Внедрение кода (head)',
	'settingsTracking.injectionDescription':
		'Пользовательский HTML/JS-код, вставляемый в <head> публичных страниц бронирования и управления — для любых тегов, не указанных выше (Meta Pixel, Plausible, собственные скрипты). Код выполняется в браузерах посетителей; настраивать могут только администраторы.',
	'settingsTracking.headLabel': '<head> HTML',
	'settingsTracking.headPlaceholder':
		'<!-- Вставьте сюда фрагмент кода GTM / GA4 / Meta Pixel -->',
	'settingsTracking.allowedOrigins': 'Разрешённые источники',
	'settingsTracking.allowedOriginsHint':
		'Оставьте пустым, чтобы разрешить любые источники https: при активном внедрении кода — самый простой вариант, при котором работают теги из GTM. Заполните, чтобы ограничить политику CSP только этими источниками (через пробел); теги с других доменов будут заблокированы.',
	'settingsTracking.dataLayerTitle': 'События dataLayer',
	'settingsTracking.dataLayerDescription':
		'Отправляет {events} в window.dataLayer, чтобы GTM мог реагировать на них.',
	'settingsTracking.fieldsHint':
		'Включаемые поля — снимите отметку с тех данных, которые не должны быть доступны в браузере или GTM.',
	'settingsTracking.fields.booking_id': 'Номер бронирования',
	'settingsTracking.fields.event_type_slug': 'Слаг типа события',
	'settingsTracking.fields.event_type_name': 'Название типа события',
	'settingsTracking.fields.start_at': 'Время начала',
	'settingsTracking.fields.end_at': 'Время окончания',
	'settingsTracking.fields.status': 'Статус',
	'settingsTracking.fields.location': 'Место',
	'settingsTracking.fields.host_name': 'Имя организатора',
	'settingsTracking.fields.attendee_name': 'Имя участника',
	'settingsTracking.fields.attendee_email': 'Email участника',
	'settingsTracking.fields.attendee_timezone': 'Часовой пояс участника',
	'settingsTracking.fields.answers': 'Ответы анкеты',
	'settingsTracking.fields.value': 'Сумма / доход',
	'settingsTracking.fields.currency': 'Валюта',
	'settingsTracking.fields.is_paid': 'Признак оплаты',
	'settingsTracking.fields.transaction_id': 'ID транзакции'
};
