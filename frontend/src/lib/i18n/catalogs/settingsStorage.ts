// Catalog for the settingsStorage module. Keys MUST be prefixed with "settingsStorage."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsStorage.loadFailed': 'Could not load storage settings',
	'settingsStorage.saved': 'Saved',
	'settingsStorage.saveFailed': 'Could not save',
	'settingsStorage.adminRequired': 'Admin access required.',
	'settingsStorage.configured': 'Configured',
	'settingsStorage.notConfigured': 'Not configured',
	'settingsStorage.storageReady': 'Storage ready',
	'settingsStorage.noBucket': 'No bucket',
	'settingsStorage.intro':
		'Object storage is used in two places — database backups and meeting recordings. They share one bucket.',
	'settingsStorage.instructionsTitle': 'Setup instructions',
	'settingsStorage.step1Part1':
		'Create a bucket with any S3-compatible object storage provider — for example ',
	'settingsStorage.step1Or': ' or ',
	'settingsStorage.step1Part2':
		'. This is the same bucket both database backups and meeting recordings write to.',
	'settingsStorage.step2':
		'Generate an access key ID and secret access key for that bucket.',
	'settingsStorage.step3Part1':
		"There's no form for this — set these as environment variables/secrets with your hosting provider, then redeploy:",
	'settingsStorage.step3Hint1':
		'For any provider other than AWS S3 (R2, B2, MinIO, etc.), also set ',
	'settingsStorage.step3Hint2':
		" to that provider's S3-compatible endpoint URL. ",
	'settingsStorage.step3Hint3':
		' is optional — only some providers need it.',
	'settingsStorage.step4Part1': 'Reload this page — once it shows ',
	'settingsStorage.step4Part2':
		', meeting recordings can be turned on beneath it.',
	'settingsStorage.backupsTitle': 'Database backups (Litestream)',
	'settingsStorage.backupsDescription':
		'Continuous SQLite replication to your bucket. Configured via environment at deploy.',
	'settingsStorage.bucketLabel': 'Bucket',
	'settingsStorage.endpointLabel': 'Endpoint',
	'settingsStorage.backupsNotConfiguredHint':
		'Set {env} and credentials to enable backups — see setup instructions above.',
	'settingsStorage.recordingsTitle': 'Meeting recordings',
	'settingsStorage.recordingsDescription':
		'LiveKit video recordings upload to the backups bucket under a {prefix} prefix.',
	'settingsStorage.allowRecordMeetings': 'Allow hosts to record meetings',
	'settingsStorage.allowRecordHint':
		'The host gets a Record button in the call; everyone sees a “Recording” banner.',
	'settingsStorage.configureBackupsFirst':
		' Configure backups first (see setup instructions above) — recordings need a bucket.'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsStorage.loadFailed': 'Не удалось загрузить настройки хранилища',
	'settingsStorage.saved': 'Сохранено',
	'settingsStorage.saveFailed': 'Не удалось сохранить',
	'settingsStorage.adminRequired': 'Требуется доступ администратора.',
	'settingsStorage.configured': 'Настроено',
	'settingsStorage.notConfigured': 'Не настроено',
	'settingsStorage.storageReady': 'Хранилище готово',
	'settingsStorage.noBucket': 'Нет бакета',
	'settingsStorage.intro':
		'Объектное хранилище используется для двух задач: резервного копирования базы данных и записей встреч. Они используют один общий бакет.',
	'settingsStorage.instructionsTitle': 'Инструкции по настройке',
	'settingsStorage.step1Part1':
		'Создайте бакет у любого S3-совместимого провайдера — например, ',
	'settingsStorage.step1Or': ' или ',
	'settingsStorage.step1Part2':
		'. В этот же бакет сохраняются и резервные копии базы данных, и видеозаписи встреч.',
	'settingsStorage.step2':
		'Сгенерируйте Access Key ID и Secret Access Key для этого бакета.',
	'settingsStorage.step3Part1':
		'Для этих параметров нет веб-формы — задайте их как переменные окружения/секреты у вашего хостинг-провайдера и выполните перезапуск:',
	'settingsStorage.step3Hint1':
		'Для любого провайдера, кроме AWS S3 (R2, B2, MinIO и т. д.), также укажите ',
	'settingsStorage.step3Hint2':
		' с адресом S3-совместимой конечной точки провайдера. ',
	'settingsStorage.step3Hint3':
		' необязателен — требуется только некоторым провайдерам.',
	'settingsStorage.step4Part1': 'Перезагрузите эту страницу — когда ниже появится статус ',
	'settingsStorage.step4Part2':
		', под ним можно будет включить запись встреч.',
	'settingsStorage.backupsTitle': 'Резервные копии БД (Litestream)',
	'settingsStorage.backupsDescription':
		'Непрерывная репликация SQLite в ваш бакет. Настраивается через переменные окружения при развертывании.',
	'settingsStorage.bucketLabel': 'Бакет',
	'settingsStorage.endpointLabel': 'Конечная точка',
	'settingsStorage.backupsNotConfiguredHint':
		'Задайте {env} и учетные данные для включения резервного копирования — см. инструкции выше.',
	'settingsStorage.recordingsTitle': 'Записи встреч',
	'settingsStorage.recordingsDescription':
		'Видеозаписи LiveKit загружаются в бакет резервных копий с префиксом {prefix}.',
	'settingsStorage.allowRecordMeetings':
		'Разрешить организаторам записывать встречи',
	'settingsStorage.allowRecordHint':
		'У организатора появится кнопка «Запись» во время звонка; все участники увидят индикатор записи.',
	'settingsStorage.configureBackupsFirst':
		' Сначала настройте резервное копирование (см. инструкции выше) — для записей требуется бакет.'
};
