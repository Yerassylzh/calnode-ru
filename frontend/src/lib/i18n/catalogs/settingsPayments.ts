// Catalog for the settingsPayments module. Keys MUST be prefixed with "settingsPayments."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsPayments.loadFailed': 'Could not load payment settings',
	'settingsPayments.saved':
		'Saved — set a price on an event type to start charging',
	'settingsPayments.saveFailed': 'Could not save payment settings',
	'settingsPayments.disconnected': 'Stripe disconnected',
	'settingsPayments.disconnectFailed': 'Could not disconnect',
	'settingsPayments.adminRequired': 'Admin access required.',
	'settingsPayments.instructionsTitle': 'Setup instructions',
	'settingsPayments.step1Part1': 'In your ',
	'settingsPayments.step1Link': 'Stripe Dashboard → Developers → API keys',
	'settingsPayments.step1Part2': ', copy the ',
	'settingsPayments.step1Secret': 'Secret key',
	'settingsPayments.step1And': ' and ',
	'settingsPayments.step1Publishable': 'Publishable key',
	'settingsPayments.step2Part1': 'Go to ',
	'settingsPayments.step2Webhooks': 'Developers → Webhooks → Add endpoint',
	'settingsPayments.step2Part2': ' and set the URL to:',
	'settingsPayments.step2Part3': 'Subscribe to ',
	'settingsPayments.step3Part1': 'Copy the endpoint’s ',
	'settingsPayments.step3SigningSecret': 'Signing secret',
	'settingsPayments.step3Part2':
		', paste all three values below, and save.',
	'settingsPayments.title': 'Stripe',
	'settingsPayments.description':
		'Lets you charge for bookings. An event type with a price sends the booker to Stripe Checkout before the slot is confirmed.',
	'settingsPayments.configured': 'Configured',
	'settingsPayments.notConfigured': 'Not configured',
	'settingsPayments.secretKey': 'Secret key',
	'settingsPayments.secretKeyPlaceholder': 'sk_live_… or sk_test_…',
	'settingsPayments.publishableKey': 'Publishable key',
	'settingsPayments.publishableKeyPlaceholder': 'pk_live_… or pk_test_…',
	'settingsPayments.webhookSecret': 'Webhook signing secret',
	'settingsPayments.storedKeep': 'Stored — leave blank to keep it.',
	'settingsPayments.webhookEndpointTitle': 'Webhook endpoint',
	'settingsPayments.webhookEndpointHint':
		'Register this in Stripe → Developers → Webhooks.',
	'settingsPayments.disconnect': 'Disconnect',
	'settingsPayments.dialogTitle': 'Remove Stripe credentials?',
	'settingsPayments.dialogDescription':
		'Paid event types will stop being bookable.'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsPayments.loadFailed': 'Не удалось загрузить настройки платежей',
	'settingsPayments.saved':
		'Сохранено — укажите стоимость в типе события, чтобы принимать оплату',
	'settingsPayments.saveFailed': 'Не удалось сохранить настройки платежей',
	'settingsPayments.disconnected': 'Stripe отключён',
	'settingsPayments.disconnectFailed': 'Не удалось отключить',
	'settingsPayments.adminRequired': 'Требуется доступ администратора.',
	'settingsPayments.instructionsTitle': 'Инструкции по настройке',
	'settingsPayments.step1Part1': 'В вашей ',
	'settingsPayments.step1Link':
		'Панели управления Stripe → Разработчикам → Ключи API',
	'settingsPayments.step1Part2': ', скопируйте ',
	'settingsPayments.step1Secret': 'Secret key',
	'settingsPayments.step1And': ' и ',
	'settingsPayments.step1Publishable': 'Publishable key',
	'settingsPayments.step2Part1': 'Перейдите в ',
	'settingsPayments.step2Webhooks':
		'Разработчикам → Вебхуки → Добавить конечную точку',
	'settingsPayments.step2Part2': ' и укажите URL:',
	'settingsPayments.step2Part3': 'Подпишитесь на ',
	'settingsPayments.step3Part1': 'Скопируйте ',
	'settingsPayments.step3SigningSecret': 'Signing secret',
	'settingsPayments.step3Part2':
		' конечной точки, вставьте все три значения ниже и сохраните.',
	'settingsPayments.title': 'Stripe',
	'settingsPayments.description':
		'Позволяет принимать оплату за бронирования. При наличии цены участник перенаправляется на Stripe Checkout до подтверждения слота.',
	'settingsPayments.configured': 'Настроено',
	'settingsPayments.notConfigured': 'Не настроено',
	'settingsPayments.secretKey': 'Secret key',
	'settingsPayments.secretKeyPlaceholder': 'sk_live_… или sk_test_…',
	'settingsPayments.publishableKey': 'Publishable key',
	'settingsPayments.publishableKeyPlaceholder': 'pk_live_… или pk_test_…',
	'settingsPayments.webhookSecret': 'Секрет подписи вебхука',
	'settingsPayments.storedKeep': 'Сохранён — оставьте пустым, чтобы не изменять.',
	'settingsPayments.webhookEndpointTitle': 'Конечная точка вебхука',
	'settingsPayments.webhookEndpointHint':
		'Зарегистрируйте этот адрес в Stripe → Разработчикам → Вебхуки.',
	'settingsPayments.disconnect': 'Отключить',
	'settingsPayments.dialogTitle': 'Удалить данные Stripe?',
	'settingsPayments.dialogDescription':
		'Платные типы событий станут недоступны для бронирования.'
};
