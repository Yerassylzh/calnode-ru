// Catalog for the settingsAI module. Keys MUST be prefixed with "settingsAI."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsAI.loadFailed': 'Could not load AI settings',
	'settingsAI.savedActive': 'Saved — AI is on',
	'settingsAI.saved': 'Saved',
	'settingsAI.saveFailed': 'Could not save AI settings',
	'settingsAI.enterEndpointAndModel': 'Enter an endpoint and model first',
	'settingsAI.connectionOk': 'Connection OK ({latency} ms)',
	'settingsAI.testFailed': 'Test failed: {error}',
	'settingsAI.testRequestFailed': 'Test request failed',
	'settingsAI.adminRequired': 'Admin access required.',
	'settingsAI.title': 'AI assistant',
	'settingsAI.description':
		"Powers conversational booking on your booking pages. Bring your own model — any OpenAI-compatible endpoint (a hosted model, or one you run yourself). Off by default; if it's unavailable, bookers just use the calendar.",
	'settingsAI.statusActive': 'Active',
	'settingsAI.statusConfiguredOff': 'Configured (off)',
	'settingsAI.statusNotConfigured': 'Not configured',
	'settingsAI.endpoint': 'API endpoint',
	'settingsAI.endpointHint':
		'OpenAI-compatible base URL; the client appends {path}.',
	'settingsAI.model': 'Model',
	'settingsAI.apiKey': 'API key',
	'settingsAI.apiKeyPlaceholder': 'Enter API key (optional for local endpoints)',
	'settingsAI.storedKeep': 'Stored — leave blank to keep it.',
	'settingsAI.enableFeatures': 'Enable AI features',
	'settingsAI.enableHint': 'Turn conversational booking on for your booking pages.',
	'settingsAI.testing': 'Testing…',
	'settingsAI.testConnection': 'Test connection',
	'settingsAI.instructionsTitle': 'Assistant instructions',
	'settingsAI.instructionsDescription':
		"Extra guidance — tone, business context, do's and don'ts. Appended to the built-in instructions (which handle the booking flow + safety and can't be edited).",
	'settingsAI.additionalInstructions': 'Additional instructions',
	'settingsAI.additionalInstructionsPlaceholder':
		"e.g. Keep a warm, professional tone. We're a law firm — mention that consultations are confidential.",
	'settingsAI.additionalInstructionsHint':
		'The assistant replies in each visitor’s own language automatically. Writing these instructions in a different language than your visitors works, but is somewhat less reliable — for best results, write them in whichever language most of your visitors use.',
	'settingsAI.viewBaseInstructions': 'View built-in base instructions (read-only)',
	'settingsAI.privacyNote':
		'Privacy: the assistant only ever receives computed availability windows and public event details — never your calendar event titles, attendees, or other private data. For strict data-residency needs, point the endpoint at inference you control.'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsAI.loadFailed': 'Не удалось загрузить настройки ИИ',
	'settingsAI.savedActive': 'Сохранено — ИИ включён',
	'settingsAI.saved': 'Сохранено',
	'settingsAI.saveFailed': 'Не удалось сохранить настройки ИИ',
	'settingsAI.enterEndpointAndModel': 'Сначала укажите конечную точку и модель',
	'settingsAI.connectionOk': 'Подключение успешно ({latency} мс)',
	'settingsAI.testFailed': 'Ошибка проверки: {error}',
	'settingsAI.testRequestFailed': 'Не удалось выполнить тестовый запрос',
	'settingsAI.adminRequired': 'Требуется доступ администратора.',
	'settingsAI.title': 'ИИ-ассистент',
	'settingsAI.description':
		'Обеспечивает бронирование через диалог на ваших страницах бронирования. Поддерживает любую OpenAI-совместимую конечную точку (облачную или локальную модель). По умолчанию выключен; если он недоступен, клиенты используют обычный календарь.',
	'settingsAI.statusActive': 'Активен',
	'settingsAI.statusConfiguredOff': 'Настроен (выкл.)',
	'settingsAI.statusNotConfigured': 'Не настроен',
	'settingsAI.endpoint': 'Конечная точка API',
	'settingsAI.endpointHint':
		'Базовый URL, совместимый с OpenAI; клиент добавляет {path}.',
	'settingsAI.model': 'Модель',
	'settingsAI.apiKey': 'Ключ API',
	'settingsAI.apiKeyPlaceholder': 'Введите ключ API (необязательно для локальных моделей)',
	'settingsAI.storedKeep': 'Сохранён — оставьте пустым, чтобы не изменять.',
	'settingsAI.enableFeatures': 'Включить функции ИИ',
	'settingsAI.enableHint': 'Включить бронирование через диалог на страницах бронирования.',
	'settingsAI.testing': 'Проверка…',
	'settingsAI.testConnection': 'Проверить подключение',
	'settingsAI.instructionsTitle': 'Инструкции для ассистента',
	'settingsAI.instructionsDescription':
		'Дополнительные указания — тон общения, контекст бизнеса, правила и ограничения. Добавляются к встроенным инструкциям (которые управляют процессом бронирования и безопасностью и не могут быть изменены).',
	'settingsAI.additionalInstructions': 'Дополнительные инструкции',
	'settingsAI.additionalInstructionsPlaceholder':
		'Например: Придерживайтесь вежливого и делового тона. Мы юридическая фирма — уточняйте, что консультации конфиденциальны.',
	'settingsAI.additionalInstructionsHint':
		'Ассистент автоматически отвечает на языке каждого посетителя. Инструкции можно писать на другом языке, но для лучших результатов формулируйте их на основном языке большинства посетителей.',
	'settingsAI.viewBaseInstructions': 'Просмотреть встроенные базовые инструкции (только чтение)',
	'settingsAI.privacyNote':
		'Конфиденциальность: ассистент получает только вычисленные интервалы доступности и публичные сведения о событии — названия событий календаря, имена участников и другие личные данные никогда не передаются. При строгих требованиях к локализации данных используйте собственную модель.'
};
