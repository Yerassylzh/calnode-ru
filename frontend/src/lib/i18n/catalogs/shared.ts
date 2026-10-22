// Catalog for the shared module. Keys MUST be prefixed with "shared."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'shared.demo.badge': 'Public demo',
	'shared.demo.text': '— data here is visible to everyone and resets automatically. Don’t enter anything private.',
	'shared.demo.viewSource': 'View source',
	'shared.demo.resetTitle': 'Reset the demo now?',
	'shared.demo.resetDescription': 'Every event type, booking, and setting is wiped and replaced with fresh sample data. This also happens automatically on a timer.',
	'shared.demo.resetConfirm': 'Reset demo',
	'shared.demo.resetting': 'Resetting…',
	'shared.demo.resetNow': 'Reset demo now',
	'shared.demo.resetDone': 'Demo reset — reloading…',
	'shared.demo.resetFailed': 'Reset failed',
	'shared.datePicker.placeholder': 'Pick a date'
};

export const ru: Record<string, CatalogEntry> = {
	'shared.demo.badge': 'Публичное демо',
	'shared.demo.text': '— данные здесь видны всем и автоматически сбрасываются. Не вводите ничего личного.',
	'shared.demo.viewSource': 'Исходный код',
	'shared.demo.resetTitle': 'Сбросить демо прямо сейчас?',
	'shared.demo.resetDescription': 'Все типы событий, бронирования и настройки будут удалены и заменены свежими демонстрационными данными. Это также происходит автоматически по таймеру.',
	'shared.demo.resetConfirm': 'Сбросить демо',
	'shared.demo.resetting': 'Сброс…',
	'shared.demo.resetNow': 'Сбросить демо сейчас',
	'shared.demo.resetDone': 'Демо сброшено — перезагрузка…',
	'shared.demo.resetFailed': 'Не удалось выполнить сброс',
	'shared.datePicker.placeholder': 'Выберите дату'
};
