// Catalog for the settingsGoogle module. Keys MUST be prefixed with "settingsGoogle."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsGoogle.loadFailed': 'Could not load Google settings',
	'settingsGoogle.saved': 'Saved — go to Calendar to connect your account',
	'settingsGoogle.saveFailed': 'Could not save Google settings',
	'settingsGoogle.adminRequired': 'Admin access required.',
	'settingsGoogle.domainMismatchTitle':
		'This page is being viewed at a different domain than Calnode is configured for',
	'settingsGoogle.domainMismatchText1': "You're browsing ",
	'settingsGoogle.domainMismatchText2': ", but this server's BASE_URL is set to ",
	'settingsGoogle.domainMismatchText3':
		'. The redirect URIs below are built from BASE_URL — if ',
	'settingsGoogle.domainMismatchText4':
		' is your real domain (for example, after pointing a custom domain at this instance), update the BASE_URL environment variable/secret with your hosting provider and redeploy, then reload this page.',
	'settingsGoogle.instructionsTitle': 'Setup instructions',
	'settingsGoogle.step1Part1': 'Go to ',
	'settingsGoogle.step1Part2':
		'. If you don’t have a project, create one — any name works.',
	'settingsGoogle.step2Part1': 'Go to ',
	'settingsGoogle.step2Apis': 'APIs & Services → Library',
	'settingsGoogle.step2Part2': ', search for ',
	'settingsGoogle.step2ApiName': 'Google Calendar API',
	'settingsGoogle.step2Part3': ', and enable it.',
	'settingsGoogle.step3Part1': 'Go to ',
	'settingsGoogle.step3Consent': 'APIs & Services → OAuth consent screen',
	'settingsGoogle.step3Part2': '. Choose ',
	'settingsGoogle.step3External': 'External',
	'settingsGoogle.step3Part3':
		' (or Internal if you have Google Workspace). Fill in the app name and your email, then save.',
	'settingsGoogle.step3Note1': 'While the app is in ',
	'settingsGoogle.step3Testing': 'Testing',
	'settingsGoogle.step3Note2':
		', only Google accounts added as test users can connect, and Google caps this at 100 users. Once your team members are ready to connect their calendars, click ',
	'settingsGoogle.step3PublishApp': 'Publish app',
	'settingsGoogle.step3Note3':
		' to lift the limit (Internal / Workspace apps have no cap). See ',
	'settingsGoogle.step3Guide': "Google's guide",
	'settingsGoogle.step4Part1': 'Go to ',
	'settingsGoogle.step4Creds':
		'Credentials → Create Credentials → OAuth client ID',
	'settingsGoogle.step4Part2': '. Set application type to ',
	'settingsGoogle.step4WebApp': 'Web application',
	'settingsGoogle.step5Part1': 'Under ',
	'settingsGoogle.step5RedirectUris': 'Authorised redirect URIs',
	'settingsGoogle.step5Part2': ', add both:',
	'settingsGoogle.step5Part3': 'Click ',
	'settingsGoogle.step5Create': 'Create',
	'settingsGoogle.step5Part4': '. Copy the Client ID and Client Secret shown.',
	'settingsGoogle.step5LocalHint':
		'If you also run Calnode locally, add the {uri} variants of both URIs too.',
	'settingsGoogle.step6': 'Paste them into the form below and save.',
	'settingsGoogle.title': 'Google OAuth',
	'settingsGoogle.description':
		'Enables Google sign-in and Google Calendar integration.',
	'settingsGoogle.configured': 'Configured',
	'settingsGoogle.notConfigured': 'Not configured',
	'settingsGoogle.clientId': 'Client ID',
	'settingsGoogle.clientSecret': 'Client Secret',
	'settingsGoogle.enterClientSecret': 'Enter client secret',
	'settingsGoogle.storedKeep': 'Stored — leave blank to keep it.',
	'settingsGoogle.redirectUrisTitle': 'Authorised redirect URIs',
	'settingsGoogle.redirectUrisHint':
		'These must be registered on your OAuth client in Google Cloud (Credentials → your client → Authorised redirect URIs).',
	'settingsGoogle.localVariantsHint':
		'If you also run Calnode locally, add the {uri} variants too.'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsGoogle.loadFailed': 'Не удалось загрузить настройки Google',
	'settingsGoogle.saved':
		'Сохранено — перейдите в Календарь, чтобы подключить аккаунт',
	'settingsGoogle.saveFailed': 'Не удалось сохранить настройки Google',
	'settingsGoogle.adminRequired': 'Требуется доступ администратора.',
	'settingsGoogle.domainMismatchTitle':
		'Эта страница открыта на домене, отличном от настроенного в Calnode',
	'settingsGoogle.domainMismatchText1': 'Вы просматриваете ',
	'settingsGoogle.domainMismatchText2':
		', но параметр BASE_URL этого сервера равен ',
	'settingsGoogle.domainMismatchText3':
		'. Приведённые ниже URI перенаправления сформированы из BASE_URL — если ',
	'settingsGoogle.domainMismatchText4':
		' это ваш настоящий домен (например, после подключения собственного домена к этому серверу), обновите переменную окружения/секрет BASE_URL у хостинг-провайдера, выполните повторное развертывание и перезагрузите страницу.',
	'settingsGoogle.instructionsTitle': 'Инструкции по настройке',
	'settingsGoogle.step1Part1': 'Перейдите в ',
	'settingsGoogle.step1Part2':
		'. Если проекта ещё нет, создайте его — подойдёт любое имя.',
	'settingsGoogle.step2Part1': 'Перейдите в ',
	'settingsGoogle.step2Apis': 'API и сервисы → Библиотека',
	'settingsGoogle.step2Part2': ', найдите ',
	'settingsGoogle.step2ApiName': 'Google Calendar API',
	'settingsGoogle.step2Part3': ' и включите его.',
	'settingsGoogle.step3Part1': 'Перейдите в ',
	'settingsGoogle.step3Consent': 'API и сервисы → Экран согласия OAuth',
	'settingsGoogle.step3Part2': '. Выберите ',
	'settingsGoogle.step3External': 'Внешний',
	'settingsGoogle.step3Part3':
		' (или Внутренний при использовании Google Workspace). Укажите название приложения и свой email, затем сохраните.',
	'settingsGoogle.step3Note1': 'Пока приложение находится в статусе ',
	'settingsGoogle.step3Testing': 'Тестирование',
	'settingsGoogle.step3Note2':
		', подключение доступно только тестовым пользователям (до 100 аккаунтов Google). Когда команда будет готова подключать календари, нажмите ',
	'settingsGoogle.step3PublishApp': 'Опубликовать приложение',
	'settingsGoogle.step3Note3':
		', чтобы снять ограничение (для внутренних приложений Workspace лимита нет). См. ',
	'settingsGoogle.step3Guide': 'руководство Google',
	'settingsGoogle.step4Part1': 'Перейдите в ',
	'settingsGoogle.step4Creds':
		'Учётные данные → Создать учётные данные → Идентификатор клиента OAuth',
	'settingsGoogle.step4Part2': '. Выберите тип приложения ',
	'settingsGoogle.step4WebApp': 'Веб-приложение',
	'settingsGoogle.step5Part1': 'В разделе ',
	'settingsGoogle.step5RedirectUris': 'Разрешённые URI перенаправления',
	'settingsGoogle.step5Part2': ' добавьте оба адреса:',
	'settingsGoogle.step5Part3': 'Нажмите ',
	'settingsGoogle.step5Create': 'Создать',
	'settingsGoogle.step5Part4':
		'. Скопируйте полученные Client ID и Client Secret.',
	'settingsGoogle.step5LocalHint':
		'Если вы также запускаете Calnode локально, добавьте варианты обоих URI с {uri}.',
	'settingsGoogle.step6': 'Вставьте их в форму ниже и сохраните.',
	'settingsGoogle.title': 'Google OAuth',
	'settingsGoogle.description':
		'Включает вход через Google и интеграцию с Google Календарём.',
	'settingsGoogle.configured': 'Настроено',
	'settingsGoogle.notConfigured': 'Не настроено',
	'settingsGoogle.clientId': 'Client ID',
	'settingsGoogle.clientSecret': 'Client Secret',
	'settingsGoogle.enterClientSecret': 'Введите секрет клиента',
	'settingsGoogle.storedKeep': 'Сохранён — оставьте пустым, чтобы не изменять.',
	'settingsGoogle.redirectUrisTitle': 'Разрешённые URI перенаправления',
	'settingsGoogle.redirectUrisHint':
		'Они должны быть указаны в вашем OAuth-клиенте в Google Cloud (Учётные данные → ваш клиент → Разрешённые URI перенаправления).',
	'settingsGoogle.localVariantsHint':
		'Если вы также запускаете Calnode локально, добавьте и варианты с {uri}.'
};
