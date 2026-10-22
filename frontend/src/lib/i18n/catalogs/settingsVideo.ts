// Catalog for the settingsVideo module. Keys MUST be prefixed with "settingsVideo."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsVideo.loadFailed': 'Could not load video settings',
	'settingsVideo.savedNotetaker': 'Notetaker settings saved',
	'settingsVideo.saveNotetakerFailed': 'Could not save notetaker settings',
	'settingsVideo.saved':
		'Saved — "Calnode Video (LiveKit)" is now selectable as an event location',
	'settingsVideo.saveFailed': 'Could not save video settings',
	'settingsVideo.webhookCopied': 'Webhook URL copied',
	'settingsVideo.copyFailed': 'Could not copy — select and copy manually',
	'settingsVideo.disconnected': 'LiveKit disconnected',
	'settingsVideo.disconnectFailed': 'Could not disconnect',
	'settingsVideo.adminRequired': 'Admin access required.',
	'settingsVideo.instructionsTitle': 'Setup instructions',
	'settingsVideo.step1Part1': 'Create a free project at ',
	'settingsVideo.step1Part2': ' (or run your own ',
	'settingsVideo.step1SelfHosted': 'self-hosted server',
	'settingsVideo.step1Part3': ' — same fields).',
	'settingsVideo.step2Part1': "Copy the project's ",
	'settingsVideo.step2WsUrl': 'WebSocket URL',
	'settingsVideo.step2Part2': ' (looks like {example}) and an API ',
	'settingsVideo.step2Key': 'key',
	'settingsVideo.step2And': ' + ',
	'settingsVideo.step2Secret': 'secret',
	'settingsVideo.step2Part3': '.',
	'settingsVideo.step3':
		'Paste them below and save. Bookings using "Calnode Video (LiveKit)" then get a built-in room — no per-host connection needed.',
	'settingsVideo.title': 'Calnode Video (LiveKit)',
	'settingsVideo.description':
		'Built-in video meetings hosted on your LiveKit server. Each booking gets a room link; guests join in the browser — no account or app required.',
	'settingsVideo.configured': 'Configured',
	'settingsVideo.notConfigured': 'Not configured',
	'settingsVideo.serverUrl': 'Server URL',
	'settingsVideo.apiKey': 'API Key',
	'settingsVideo.apiSecret': 'API Secret',
	'settingsVideo.enterApiSecret': 'Enter API secret',
	'settingsVideo.storedKeep': 'Stored — leave blank to keep it.',
	'settingsVideo.disconnect': 'Disconnect',
	'settingsVideo.recordingsNeedStorage':
		'Meeting recordings need object storage set up first.',
	'settingsVideo.recordingsReadyTurnOn':
		'Object storage is ready — turn recordings on to let hosts record meetings.',
	'settingsVideo.goToStorage': 'Go to Settings → Storage',
	'settingsVideo.webhookTitle': 'Webhook (recommended)',
	'settingsVideo.webhookDescription':
		'Register this URL in LiveKit so recordings finalize with accurate duration and end cleanly when a meeting closes. Recordings still work without it — this just makes them reliable.',
	'settingsVideo.webhookStep1Part1': '1. In LiveKit Cloud, open ',
	'settingsVideo.webhookStep1Settings': 'Project → Settings → Webhooks',
	'settingsVideo.webhookStep1Docs': 'docs',
	'settingsVideo.webhookStep2Part1':
		'2. Add a webhook with the URL above, and attach the ',
	'settingsVideo.webhookStep2Key': 'same API key',
	'settingsVideo.webhookStep2Part2':
		' you entered here — it signs the events so Calnode can verify them.',
	'settingsVideo.webhookStep3':
		'3. Save. LiveKit sends all project events to this one URL; Calnode verifies each signature and uses the recording-related ones.',
	'settingsVideo.notetakerTitle': 'AI meeting notes (notetaker)',
	'settingsVideo.notetakerDescription':
		'After a meeting is recorded, transcribe it and summarize it into notes on the booking (using your configured LLM). Needs recording on, an LLM configured, and a Deepgram key.',
	'settingsVideo.deepgramKey': 'Deepgram API key',
	'settingsVideo.enterDeepgramKey': 'Enter Deepgram API key',
	'settingsVideo.getDeepgramKey': 'Get one at '
};

export const ru: Record<string, CatalogEntry> = {
	'settingsVideo.loadFailed': 'Не удалось загрузить настройки видео',
	'settingsVideo.savedNotetaker': 'Настройки конспектирования сохранены',
	'settingsVideo.saveNotetakerFailed':
		'Не удалось сохранить настройки конспектирования',
	'settingsVideo.saved':
		'Сохранено — «Calnode Video (LiveKit)» теперь можно выбрать в качестве места проведения',
	'settingsVideo.saveFailed': 'Не удалось сохранить настройки видео',
	'settingsVideo.webhookCopied': 'URL вебхука скопирован',
	'settingsVideo.copyFailed':
		'Не удалось скопировать — выделите и скопируйте вручную',
	'settingsVideo.disconnected': 'LiveKit отключён',
	'settingsVideo.disconnectFailed': 'Не удалось отключить',
	'settingsVideo.adminRequired': 'Требуется доступ администратора.',
	'settingsVideo.instructionsTitle': 'Инструкции по настройке',
	'settingsVideo.step1Part1': 'Создайте бесплатный проект на ',
	'settingsVideo.step1Part2': ' (или запустите собственный ',
	'settingsVideo.step1SelfHosted': 'сервер',
	'settingsVideo.step1Part3': ' — поля те же).',
	'settingsVideo.step2Part1': 'Скопируйте ',
	'settingsVideo.step2WsUrl': 'WebSocket URL',
	'settingsVideo.step2Part2': ' проекта (вида {example}) и API ',
	'settingsVideo.step2Key': 'key',
	'settingsVideo.step2And': ' + ',
	'settingsVideo.step2Secret': 'secret',
	'settingsVideo.step2Part3': '.',
	'settingsVideo.step3':
		'Вставьте их ниже и сохраните. Для бронирований с «Calnode Video (LiveKit)» будет создаваться встроенная комната без отдельного подключения каждым организатором.',
	'settingsVideo.title': 'Calnode Video (LiveKit)',
	'settingsVideo.description':
		'Встроенные видеовстречи на вашем сервере LiveKit. Каждое бронирование получает ссылку на комнату; гости подключаются в браузере без аккаунта или приложения.',
	'settingsVideo.configured': 'Настроено',
	'settingsVideo.notConfigured': 'Не настроено',
	'settingsVideo.serverUrl': 'URL сервера',
	'settingsVideo.apiKey': 'API Key',
	'settingsVideo.apiSecret': 'API Secret',
	'settingsVideo.enterApiSecret': 'Введите API Secret',
	'settingsVideo.storedKeep': 'Сохранён — оставьте пустым, чтобы не изменять.',
	'settingsVideo.disconnect': 'Отключить',
	'settingsVideo.recordingsNeedStorage':
		'Для записи встреч сначала требуется настроить объектное хранилище.',
	'settingsVideo.recordingsReadyTurnOn':
		'Хранилище готово — включите записи, чтобы организаторы могли записывать встречи.',
	'settingsVideo.goToStorage': 'Перейти в Настройки → Хранилище',
	'settingsVideo.webhookTitle': 'Вебхук (рекомендуется)',
	'settingsVideo.webhookDescription':
		'Зарегистрируйте этот URL в LiveKit, чтобы записи корректно завершались с точной длительностью при закрытии встречи. Записи работают и без этого, но вебхук обеспечивает их надёжность.',
	'settingsVideo.webhookStep1Part1': '1. В LiveKit Cloud откройте ',
	'settingsVideo.webhookStep1Settings': 'Project → Settings → Webhooks',
	'settingsVideo.webhookStep1Docs': 'документация',
	'settingsVideo.webhookStep2Part1':
		'2. Добавьте вебхук с указанным выше URL и укажите ',
	'settingsVideo.webhookStep2Key': 'тот же API key',
	'settingsVideo.webhookStep2Part2':
		', который вы ввели здесь — он подписывает события для проверки Calnode.',
	'settingsVideo.webhookStep3':
		'3. Сохраните. LiveKit отправляет все события проекта на этот URL; Calnode проверяет подпись и обрабатывает относящиеся к записям.',
	'settingsVideo.notetakerTitle': 'ИИ-конспекты встреч (ноуттейкер)',
	'settingsVideo.notetakerDescription':
		'После записи встречи выполняет транскрибацию и формирует краткий конспект в карточке бронирования (через настроенную LLM). Требуются включённые записи, настроенная LLM и ключ Deepgram.',
	'settingsVideo.deepgramKey': 'Ключ API Deepgram',
	'settingsVideo.enterDeepgramKey': 'Введите ключ API Deepgram',
	'settingsVideo.getDeepgramKey': 'Получите ключ на '
};
