// Catalog for the connections module. Keys MUST be prefixed with "connections."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'connections.pageTitle': 'Connected apps — Calnode',
	'connections.heading': 'Connected apps',
	'connections.subtitle':
		"AI agents and other apps you've connected to your scheduling tools (MCP) via sign-in.",
	'connections.copyFailed': 'Could not copy. Select the URL and copy it manually.',

	'connections.dialog.title': 'Disconnect app?',
	'connections.dialog.description':
		'Disconnect "{name}"? It will immediately lose access to your scheduling tools and must reconnect to regain it.',
	'connections.actions.disconnect': 'Disconnect',

	'connections.connect.title': 'Connect an app',
	'connections.connect.description':
		'Add this URL as a custom connector in any MCP-capable app, then sign in when it asks. The app appears below once you approve it.',
	'connections.connect.urlAria': 'MCP connector URL',
	'connections.connect.claude': 'In Claude: ',
	'connections.connect.claudeSteps': 'Settings → Connectors → Add custom connector',
	'connections.connect.claudeRest':
		", paste the URL, then sign in with your Calnode account to authorize it. Access is scoped to your own role, and you can revoke it here at any time.",

	'connections.empty.title': 'No connected apps',
	'connections.empty.description':
		'Use the URL above to add Calnode to an MCP-capable app. Once you approve it, it shows up here.',

	'connections.table.app': 'App',
	'connections.table.connected': 'Connected',
	'connections.table.lastUsed': 'Last used',
	'connections.table.never': 'Never'
};

export const ru: Record<string, CatalogEntry> = {
	'connections.pageTitle': 'Подключённые приложения — Calnode',
	'connections.heading': 'Подключённые приложения',
	'connections.subtitle':
		'AI-агенты и другие приложения, которые вы подключили к своим инструментам планирования (MCP) через вход в систему.',
	'connections.copyFailed': 'Не удалось скопировать. Выделите URL-адрес и скопируйте его вручную.',

	'connections.dialog.title': 'Отключить приложение?',
	'connections.dialog.description':
		'Отключить «{name}»? Оно немедленно потеряет доступ к вашим инструментам планирования, и для его восстановления потребуется повторное подключение.',
	'connections.actions.disconnect': 'Отключить',

	'connections.connect.title': 'Подключить приложение',
	'connections.connect.description':
		'Добавьте этот URL-адрес как пользовательский коннектор в любом приложении с поддержкой MCP, затем выполните вход, когда оно его запросит. После подтверждения доступа приложение появится ниже.',
	'connections.connect.urlAria': 'URL-адрес коннектора MCP',
	'connections.connect.claude': 'В Claude: ',
	'connections.connect.claudeSteps': 'Настройки → Коннекторы → Добавить пользовательский коннектор',
	'connections.connect.claudeRest':
		', вставьте URL-адрес и выполните вход со своей учётной записью Calnode, чтобы предоставить доступ. Доступ ограничен вашей ролью, и вы можете отозвать его здесь в любой момент.',

	'connections.empty.title': 'Нет подключённых приложений',
	'connections.empty.description':
		'Используйте URL-адрес выше, чтобы добавить Calnode в приложение с поддержкой MCP. После подтверждения доступа оно появится здесь.',

	'connections.table.app': 'Приложение',
	'connections.table.connected': 'Подключено',
	'connections.table.lastUsed': 'Последнее использование',
	'connections.table.never': 'Никогда'
};
