// Catalog for the apiKeys module. Keys MUST be prefixed with "apiKeys."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'apiKeys.pageTitle': 'API Keys — Calnode',
	'apiKeys.title': 'API Keys',
	'apiKeys.subtitle': 'Authenticate CLI tools and integrations.',
	'apiKeys.newKey': 'New key',
	'apiKeys.newApiKey': 'New API key',
	'apiKeys.keyCreatedNotice': "Key created — copy it now. It won't be shown again.",
	'apiKeys.copyToClipboard': 'Copy to clipboard',
	'apiKeys.keyName': 'Key name',
	'apiKeys.namePlaceholder': 'e.g. CI/CD pipeline',
	'apiKeys.createKey': 'Create key',
	'apiKeys.creating': 'Creating…',
	'apiKeys.nameRequired': 'Name is required.',
	'apiKeys.emptyTitle': 'No API keys',
	'apiKeys.emptyDescription': 'Create a key to authenticate CLI tools and integrations.',
	'apiKeys.colName': 'Name',
	'apiKeys.colCreated': 'Created',
	'apiKeys.colLastUsed': 'Last used',
	'apiKeys.never': 'Never',
	'apiKeys.revoke': 'Revoke',
	'apiKeys.revokeKey': 'Revoke key',
	'apiKeys.revokeTitle': 'Revoke API key?',
	'apiKeys.revokeDescription': 'Revoke "{name}"? Any integrations using it will stop working immediately.'
};

export const ru: Record<string, CatalogEntry> = {
	'apiKeys.pageTitle': 'API-ключи — Calnode',
	'apiKeys.title': 'API-ключи',
	'apiKeys.subtitle': 'Аутентификация CLI-инструментов и интеграций.',
	'apiKeys.newKey': 'Новый ключ',
	'apiKeys.newApiKey': 'Новый API-ключ',
	'apiKeys.keyCreatedNotice': 'Ключ создан — скопируйте его сейчас. Повторно он показан не будет.',
	'apiKeys.copyToClipboard': 'Копировать в буфер обмена',
	'apiKeys.keyName': 'Название ключа',
	'apiKeys.namePlaceholder': 'Например, CI/CD pipeline',
	'apiKeys.createKey': 'Создать ключ',
	'apiKeys.creating': 'Создание…',
	'apiKeys.nameRequired': 'Укажите название.',
	'apiKeys.emptyTitle': 'Нет API-ключей',
	'apiKeys.emptyDescription': 'Создайте ключ для аутентификации CLI-инструментов и интеграций.',
	'apiKeys.colName': 'Название',
	'apiKeys.colCreated': 'Создан',
	'apiKeys.colLastUsed': 'Последнее использование',
	'apiKeys.never': 'Никогда',
	'apiKeys.revoke': 'Отозвать',
	'apiKeys.revokeKey': 'Отозвать ключ',
	'apiKeys.revokeTitle': 'Отозвать API-ключ?',
	'apiKeys.revokeDescription': 'Отозвать «{name}»? Все интеграции, использующие его, сразу перестанут работать.'
};
