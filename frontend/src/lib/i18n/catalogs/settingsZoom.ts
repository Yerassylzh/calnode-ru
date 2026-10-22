// Catalog for the settingsZoom module. Keys MUST be prefixed with "settingsZoom."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsZoom.loadFailed': 'Could not load Zoom settings',
	'settingsZoom.saved':
		'Saved — each host can now connect Zoom from the Calendar page',
	'settingsZoom.saveFailed': 'Could not save Zoom settings',
	'settingsZoom.adminRequired': 'Admin access required.',
	'settingsZoom.instructionsTitle': 'Setup instructions',
	'settingsZoom.step1Part1': 'Go to the ',
	'settingsZoom.step1Link': 'Zoom App Marketplace',
	'settingsZoom.step1Part2': ' and sign in with your Zoom account. Click ',
	'settingsZoom.step1Develop': 'Develop → Build App',
	'settingsZoom.step1Part3': '.',
	'settingsZoom.step2Part1': 'Choose a ',
	'settingsZoom.step2GeneralApp': 'General App',
	'settingsZoom.step2Part2':
		' (User-managed OAuth). While it is unpublished, Zoom only lets users ',
	'settingsZoom.step2AccountOwner': 'inside the Zoom account that owns the app',
	'settingsZoom.step2Part3':
		' connect; hosts with their own separate Zoom accounts need a published app (see DEPLOY.md, "Zoom meeting links"). If that rules Zoom out, built-in video needs no Zoom app at all — see ',
	'settingsZoom.step3Part1': 'Under ',
	'settingsZoom.step3OAuth': 'OAuth',
	'settingsZoom.step3Part2': ', set the ',
	'settingsZoom.step3RedirectUrl': 'Redirect URL for OAuth',
	'settingsZoom.step3Part3': ' (and add it to the allow list) to:',
	'settingsZoom.step4Part1': 'Under ',
	'settingsZoom.step4Scopes': 'Scopes',
	'settingsZoom.step4Part2': ', add ',
	'settingsZoom.step4Part3':
		" (create/update/delete meetings on the user's behalf).",
	'settingsZoom.step5Part1': 'Copy the ',
	'settingsZoom.step5ClientId': 'Client ID',
	'settingsZoom.step5And': ' and ',
	'settingsZoom.step5ClientSecret': 'Client Secret',
	'settingsZoom.step5Part2':
		" from the app's Basic Information, paste them below, and save.",
	'settingsZoom.title': 'Zoom',
	'settingsZoom.description':
		'Lets each host connect their own Zoom account so Zoom-located bookings get a real meeting link minted automatically.',
	'settingsZoom.configured': 'Configured',
	'settingsZoom.notConfigured': 'Not configured',
	'settingsZoom.clientId': 'Client ID',
	'settingsZoom.clientSecret': 'Client Secret',
	'settingsZoom.enterClientSecret': 'Enter client secret',
	'settingsZoom.storedKeep': 'Stored — leave blank to keep it.',
	'settingsZoom.redirectUrlTitle': 'Redirect URL',
	'settingsZoom.redirectUrlHint':
		'This must be registered on your Zoom app (OAuth → Redirect URL + OAuth allow list).',
	'settingsZoom.limitWarningBold': 'Multi-member limit:',
	'settingsZoom.limitWarningText':
		" only Zoom users on the same Zoom account as this app's owner can connect an unpublished app — members elsewhere are refused by Zoom before Calnode is involved. Options: ",
	'settingsZoom.limitWarningBuiltin':
		' (built-in video needs no Zoom app at all).'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsZoom.loadFailed': 'Не удалось загрузить настройки Zoom',
	'settingsZoom.saved':
		'Сохранено — теперь каждый организатор может подключить Zoom на странице «Календарь»',
	'settingsZoom.saveFailed': 'Не удалось сохранить настройки Zoom',
	'settingsZoom.adminRequired': 'Требуется доступ администратора.',
	'settingsZoom.instructionsTitle': 'Инструкции по настройке',
	'settingsZoom.step1Part1': 'Перейдите в ',
	'settingsZoom.step1Link': 'Zoom App Marketplace',
	'settingsZoom.step1Part2': ' и войдите в свой аккаунт Zoom. Нажмите ',
	'settingsZoom.step1Develop': 'Develop → Build App',
	'settingsZoom.step1Part3': '.',
	'settingsZoom.step2Part1': 'Выберите ',
	'settingsZoom.step2GeneralApp': 'General App',
	'settingsZoom.step2Part2':
		' (User-managed OAuth). Пока приложение не опубликовано, Zoom разрешает подключение только пользователям ',
	'settingsZoom.step2AccountOwner':
		'внутри аккаунта Zoom, создавшего приложение',
	'settingsZoom.step2Part3':
		'; организаторам с отдельными аккаунтами Zoom требуется опубликованное приложение (см. DEPLOY.md, «Zoom meeting links»). Если это не подходит, встроенное видео вообще не требует приложения Zoom — см. ',
	'settingsZoom.step3Part1': 'В разделе ',
	'settingsZoom.step3OAuth': 'OAuth',
	'settingsZoom.step3Part2': ', укажите ',
	'settingsZoom.step3RedirectUrl': 'Redirect URL for OAuth',
	'settingsZoom.step3Part3': ' (и добавьте его в список разрешённых):',
	'settingsZoom.step4Part1': 'В разделе ',
	'settingsZoom.step4Scopes': 'Scopes',
	'settingsZoom.step4Part2': ', добавьте ',
	'settingsZoom.step4Part3':
		' (создание, изменение и удаление встреч от имени пользователя).',
	'settingsZoom.step5Part1': 'Скопируйте ',
	'settingsZoom.step5ClientId': 'Client ID',
	'settingsZoom.step5And': ' и ',
	'settingsZoom.step5ClientSecret': 'Client Secret',
	'settingsZoom.step5Part2':
		' из раздела Basic Information приложения, вставьте их ниже и сохраните.',
	'settingsZoom.title': 'Zoom',
	'settingsZoom.description':
		'Позволяет каждому организатору подключить личный аккаунт Zoom, чтобы при бронировании встреч в Zoom автоматически создавалась ссылка на встречу.',
	'settingsZoom.configured': 'Настроено',
	'settingsZoom.notConfigured': 'Не настроено',
	'settingsZoom.clientId': 'Client ID',
	'settingsZoom.clientSecret': 'Client Secret',
	'settingsZoom.enterClientSecret': 'Введите client secret',
	'settingsZoom.storedKeep': 'Сохранён — оставьте пустым, чтобы не изменять.',
	'settingsZoom.redirectUrlTitle': 'Redirect URL',
	'settingsZoom.redirectUrlHint':
		'Этот адрес должен быть указан в вашем приложении Zoom (OAuth → Redirect URL + список разрешений OAuth).',
	'settingsZoom.limitWarningBold': 'Ограничение для участников:',
	'settingsZoom.limitWarningText':
		' только пользователи из того же аккаунта Zoom, что и владелец приложения, могут подключить неопубликованное приложение — пользователям из других аккаунтов Zoom откажет ещё до обращения к Calnode. Варианты: ',
	'settingsZoom.limitWarningBuiltin':
		' (встроенное видео вообще не требует приложения Zoom).'
};
