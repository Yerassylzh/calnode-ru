// Catalog for the settingsLayout module. Keys MUST be prefixed with "settingsLayout."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'settingsLayout.pageTitle': 'Settings — Calnode',
	'settingsLayout.heading': 'Settings',
	'settingsLayout.subtitle': 'Manage your profile and preferences.',
	'settingsLayout.section.account': 'Your account',
	'settingsLayout.section.advanced': 'Advanced',
	'settingsLayout.nav.profile': 'Profile',
	'settingsLayout.nav.notifications': 'Notifications',
	'settingsLayout.nav.email': 'Email',
	'settingsLayout.nav.video': 'Video',
	'settingsLayout.nav.storage': 'Storage'
};

export const ru: Record<string, CatalogEntry> = {
	'settingsLayout.pageTitle': 'Настройки — Calnode',
	'settingsLayout.heading': 'Настройки',
	'settingsLayout.subtitle': 'Управляйте профилем и параметрами.',
	'settingsLayout.section.account': 'Ваш аккаунт',
	'settingsLayout.section.advanced': 'Дополнительно',
	'settingsLayout.nav.profile': 'Профиль',
	'settingsLayout.nav.notifications': 'Уведомления',
	'settingsLayout.nav.email': 'Эл. почта',
	'settingsLayout.nav.video': 'Видео',
	'settingsLayout.nav.storage': 'Хранилище',
};
