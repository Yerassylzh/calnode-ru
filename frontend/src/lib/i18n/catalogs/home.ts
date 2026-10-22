// Catalog for the home module. Keys MUST be prefixed with "home."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'home.pageTitle': 'Dashboard — Calnode',
	'home.title': 'Dashboard',
	'home.doneSubtitle': 'Your booking page is live and ready to share.',
	'home.singleLinkTitle': 'Your booking link',
	'home.multiLinkTitle': 'Your booking links',
	'home.profileLinkTitle': 'Your profile page',
	'home.copied': 'Copied!',
	'home.copyFailed': 'Failed',
	'home.gettingStarted': 'Getting started',
	'home.gettingStartedSubtitle': "Complete these steps and you'll be ready to take bookings.",
	'home.step.calendar': 'Connect your calendar',
	'home.step.calendarConfigured': 'Calnode checks your calendar to prevent double-bookings.',
	'home.step.calendarNotConfigured': 'Google Calendar setup required — see the Calendar page for details.',
	'home.step.availability': 'Set your availability',
	'home.step.availabilityDesc': 'Define the hours when people can book time with you.',
	'home.step.eventType': 'Create your first event type',
	'home.step.eventTypeDesc': 'An event type defines the duration, location, and availability for a booking.',
	'home.step.share': 'Share your booking link',
	'home.step.shareReady': 'Your page is live. Share it and start taking bookings.',
	'home.step.sharePending': "Available once you've created an event type."
};

export const ru: Record<string, CatalogEntry> = {
	'home.pageTitle': 'Панель управления — Calnode',
	'home.title': 'Панель управления',
	'home.doneSubtitle': 'Ваша страница бронирования готова — ею можно делиться.',
	'home.singleLinkTitle': 'Ваша ссылка для бронирования',
	'home.multiLinkTitle': 'Ваши ссылки для бронирования',
	'home.profileLinkTitle': 'Ваша страница профиля',
	'home.copied': 'Скопировано!',
	'home.copyFailed': 'Не удалось',
	'home.gettingStarted': 'Начало работы',
	'home.gettingStartedSubtitle': 'Выполните эти шаги — и вы сможете принимать бронирования.',
	'home.step.calendar': 'Подключите свой календарь',
	'home.step.calendarConfigured': 'Calnode сверяется с вашим календарём, чтобы исключить двойные бронирования.',
	'home.step.calendarNotConfigured': 'Требуется настройка Google Календаря — подробности на странице «Календарь».',
	'home.step.availability': 'Задайте свою доступность',
	'home.step.availabilityDesc': 'Укажите часы, когда люди могут бронировать время с вами.',
	'home.step.eventType': 'Создайте свой первый тип события',
	'home.step.eventTypeDesc': 'Тип события определяет продолжительность, место проведения и доступность для бронирования.',
	'home.step.share': 'Поделитесь своей ссылкой для бронирования',
	'home.step.shareReady': 'Ваша страница активна. Поделитесь ею и начните принимать бронирования.',
	'home.step.sharePending': 'Станет доступна после создания типа события.'
};
