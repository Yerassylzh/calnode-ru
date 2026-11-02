// Catalog for doctor breaktimes management. Keys MUST be prefixed with "doctorBreaks."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'doctorBreaks.pageTitle': 'Doctor Breaks — Calnode',
	'doctorBreaks.heading': 'Doctor & Specialist Breaks',
	'doctorBreaks.subtitle': 'Convenient break and lunch management for doctors and specialists.',
	'doctorBreaks.selectDoctor': 'Doctor / Specialist',
	'doctorBreaks.doctorPlaceholder': 'Choose a doctor…',
	'doctorBreaks.allDoctors': 'All Specialists',
	'doctorBreaks.doctorRole': 'Specialist',
	'doctorBreaks.timezone': 'Timezone',
	'doctorBreaks.weeklyHours': 'Working Hours',
	'doctorBreaks.noHoursSet': 'Working hours not set',
	'doctorBreaks.setStandardHours': 'Set default hours (Mon–Fri 09:00–18:00)',
	'doctorBreaks.hoursUpdated': 'Working hours updated',

	// Navigation & Daily Schedule
	'doctorBreaks.today': 'Today',
	'doctorBreaks.tomorrow': 'Tomorrow',
	'doctorBreaks.yesterday': 'Yesterday',
	'doctorBreaks.prevDay': 'Previous day',
	'doctorBreaks.nextDay': 'Next day',
	'doctorBreaks.pickDate': 'Pick date',
	'doctorBreaks.breaksOnDate': 'Breaks on this date',
	'doctorBreaks.noBreaksOnDate': 'No breaks for this date',
	'doctorBreaks.noBreaksOnDateDesc': 'The specialist accepts bookings during regular hours.',
	'doctorBreaks.addBreakQuick': 'Add break',

	// Form
	'doctorBreaks.addBreak': 'Add Break',
	'doctorBreaks.addBreakDesc': 'Choose date or recurrence, enter time range and save.',
	'doctorBreaks.timeRange': 'Break time',
	'doctorBreaks.timeFrom': 'Start time',
	'doctorBreaks.timeTo': 'End time',
	'doctorBreaks.duration': 'Duration',
	'doctorBreaks.applyMode': 'Repetition',
	'doctorBreaks.applyThisDate': 'Only this day',
	'doctorBreaks.applyWeekly': 'Weekly',
	'doctorBreaks.titleLabel': 'Title or reason',
	'doctorBreaks.titlePlaceholder': 'E.g. Lunch break',
	'doctorBreaks.defaultTitle': 'Lunch',
	'doctorBreaks.submit': 'Save Break',
	'doctorBreaks.submitting': 'Saving…',

	// Break cards & listing
	'doctorBreaks.badgeWeekly': 'Weekly ({day})',
	'doctorBreaks.badgeDate': 'One-time ({date})',
	'doctorBreaks.activeBreaks': 'Configured Breaks',
	'doctorBreaks.breakCount': { one: '{count} break', other: '{count} breaks' },
	'doctorBreaks.showAllBreaks': 'View all master breaks',
	'doctorBreaks.hideAllBreaks': 'Hide master breaks',
	'doctorBreaks.allBreaksTitle': 'All configured breaks of doctor',
	'doctorBreaks.allBreaksEmpty': 'No breaks configured yet.',

	// Confirm delete
	'doctorBreaks.deleteConfirmTitle': 'Delete this break?',
	'doctorBreaks.deleteConfirmDesc': 'This time slot will become available for booking again.',
	'doctorBreaks.deletedSuccess': 'Break deleted',
	'doctorBreaks.addedSuccess': 'Break saved successfully',

	// Days
	'doctorBreaks.day.0': 'Sunday',
	'doctorBreaks.day.1': 'Monday',
	'doctorBreaks.day.2': 'Tuesday',
	'doctorBreaks.day.3': 'Wednesday',
	'doctorBreaks.day.4': 'Thursday',
	'doctorBreaks.day.5': 'Friday',
	'doctorBreaks.day.6': 'Saturday',
	'doctorBreaks.dayShort.0': 'Sun',
	'doctorBreaks.dayShort.1': 'Mon',
	'doctorBreaks.dayShort.2': 'Tue',
	'doctorBreaks.dayShort.3': 'Wed',
	'doctorBreaks.dayShort.4': 'Thu',
	'doctorBreaks.dayShort.5': 'Fri',
	'doctorBreaks.dayShort.6': 'Sat',

	// Validation
	'doctorBreaks.error.doctorRequired': 'Please select a doctor',
	'doctorBreaks.error.dayRequired': 'Select a day',
	'doctorBreaks.error.dateRequired': 'Select a date',
	'doctorBreaks.error.timeInvalid': 'End time must be after start time'
};

export const ru: Record<string, CatalogEntry> = {
	'doctorBreaks.pageTitle': 'Перерывы врачей — Calnode',
	'doctorBreaks.heading': 'Перерывы врачей и специалистов',
	'doctorBreaks.subtitle': 'Удобная настройка обедов, санитарных часов и времени отдыха для специалистов.',
	'doctorBreaks.selectDoctor': 'Врач / Специалист',
	'doctorBreaks.doctorPlaceholder': 'Выберите врача из списка…',
	'doctorBreaks.allDoctors': 'Все специалисты',
	'doctorBreaks.doctorRole': 'Специалист',
	'doctorBreaks.timezone': 'Часовой пояс',
	'doctorBreaks.weeklyHours': 'Рабочие часы',
	'doctorBreaks.noHoursSet': 'Рабочие часы не настроены',
	'doctorBreaks.setStandardHours': 'Задать стандартные часы (Пн–Пт 09:00–18:00)',
	'doctorBreaks.hoursUpdated': 'Рабочие часы установлены',

	// Navigation & Daily Schedule
	'doctorBreaks.today': 'Сегодня',
	'doctorBreaks.tomorrow': 'Завтра',
	'doctorBreaks.yesterday': 'Вчера',
	'doctorBreaks.prevDay': 'Предыдущий день',
	'doctorBreaks.nextDay': 'Следующий день',
	'doctorBreaks.pickDate': 'Выбрать дату',
	'doctorBreaks.breaksOnDate': 'Перерывы на выбранный день',
	'doctorBreaks.noBreaksOnDate': 'На этот день перерывов нет',
	'doctorBreaks.noBreaksOnDateDesc': 'Врач доступен для записи пациентов по обычному графику.',
	'doctorBreaks.addBreakQuick': 'Добавить перерыв',

	// Form
	'doctorBreaks.addBreak': 'Добавить перерыв',
	'doctorBreaks.addBreakDesc': 'Выберите дату или день, укажите время начала и конца, затем сохраните.',
	'doctorBreaks.timeRange': 'Время перерыва',
	'doctorBreaks.timeFrom': 'Начало (С)',
	'doctorBreaks.timeTo': 'Конец (До)',
	'doctorBreaks.duration': 'Длительность',
	'doctorBreaks.applyMode': 'Повторение',
	'doctorBreaks.applyThisDate': 'Только в этот день',
	'doctorBreaks.applyWeekly': 'Каждую неделю',
	'doctorBreaks.titleLabel': 'Название или причина',
	'doctorBreaks.titlePlaceholder': 'Например: Обед',
	'doctorBreaks.defaultTitle': 'Обед',
	'doctorBreaks.submit': 'Сохранить перерыв',
	'doctorBreaks.submitting': 'Сохранение…',

	// Break cards & listing
	'doctorBreaks.badgeWeekly': 'Еженедельно ({day})',
	'doctorBreaks.badgeDate': 'Только на {date}',
	'doctorBreaks.activeBreaks': 'Настроенные перерывы',
	'doctorBreaks.breakCount': { one: '{count} перерыв', few: '{count} перерыва', many: '{count} перерывов', other: '{count} перерыва' },
	'doctorBreaks.showAllBreaks': 'Показать общий список всех перерывов',
	'doctorBreaks.hideAllBreaks': 'Скрыть общий список всех перерывов',
	'doctorBreaks.allBreaksTitle': 'Все настроенные перерывы специалиста',
	'doctorBreaks.allBreaksEmpty': 'У врача пока нет настроенных перерывов.',

	// Confirm delete
	'doctorBreaks.deleteConfirmTitle': 'Удалить этот перерыв?',
	'doctorBreaks.deleteConfirmDesc': 'Это время снова станет доступным для записи пациентов.',
	'doctorBreaks.deletedSuccess': 'Перерыв удалён',
	'doctorBreaks.addedSuccess': 'Перерыв успешно сохранён',

	// Days
	'doctorBreaks.day.0': 'Воскресенье',
	'doctorBreaks.day.1': 'Понедельник',
	'doctorBreaks.day.2': 'Вторник',
	'doctorBreaks.day.3': 'Среда',
	'doctorBreaks.day.4': 'Четверг',
	'doctorBreaks.day.5': 'Пятница',
	'doctorBreaks.day.6': 'Суббота',
	'doctorBreaks.dayShort.0': 'Вс',
	'doctorBreaks.dayShort.1': 'Пн',
	'doctorBreaks.dayShort.2': 'Вт',
	'doctorBreaks.dayShort.3': 'Ср',
	'doctorBreaks.dayShort.4': 'Чт',
	'doctorBreaks.dayShort.5': 'Пт',
	'doctorBreaks.dayShort.6': 'Сб',

	// Validation
	'doctorBreaks.error.doctorRequired': 'Выберите врача',
	'doctorBreaks.error.dayRequired': 'Выберите день',
	'doctorBreaks.error.dateRequired': 'Укажите дату',
	'doctorBreaks.error.timeInvalid': 'Время окончания должно быть позже времени начала'
};
