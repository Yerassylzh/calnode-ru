// Catalog for the questionsPanel module. Keys MUST be prefixed with "questionsPanel."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'questionsPanel.heading': 'Intake Questions',
	'questionsPanel.subtitle': 'Collect information from attendees when they book.',
	'questionsPanel.colQuestion': 'Question',
	'questionsPanel.type': 'Type',
	'questionsPanel.required': 'Required',
	'questionsPanel.label': 'Label',
	'questionsPanel.optionsLabel': 'Options (one per line)',
	'questionsPanel.labelPlaceholder': "e.g. What's the meeting about?",
	'questionsPanel.optionsPlaceholder': 'Option A\nOption B\nOption C',
	'questionsPanel.empty': 'No questions yet.',
	'questionsPanel.adding': 'Adding…',
	'questionsPanel.addQuestion': 'Add question',
	'questionsPanel.typeText': 'Text',
	'questionsPanel.typeCheckbox': 'Checkbox (yes/no)',
	'questionsPanel.typeSelect': 'Dropdown',
	'questionsPanel.delete.title': 'Remove question?',
	'questionsPanel.delete.description': '"{label}" will be removed from this event type\'s booking form.',
	'questionsPanel.errors.load': 'Could not load questions',
	'questionsPanel.errors.add': 'Could not add question',
	'questionsPanel.errors.save': 'Could not save question',
	'questionsPanel.errors.delete': 'Could not delete question',
	'questionsPanel.errors.labelRequired': 'Label is required.',
	'questionsPanel.errors.optionRequired': 'At least one option is required.',
	'questionsPanel.errors.optionRequiredDropdown': 'At least one option is required for dropdown questions.'
};

export const ru: Record<string, CatalogEntry> = {
	'questionsPanel.heading': 'Вопросы при бронировании',
	'questionsPanel.subtitle': 'Собирайте информацию от участников при бронировании.',
	'questionsPanel.colQuestion': 'Вопрос',
	'questionsPanel.type': 'Тип',
	'questionsPanel.required': 'Обязательный',
	'questionsPanel.label': 'Название',
	'questionsPanel.optionsLabel': 'Варианты (по одному в строке)',
	'questionsPanel.labelPlaceholder': 'Например: О чём встреча?',
	'questionsPanel.optionsPlaceholder': 'Вариант A\nВариант B\nВариант C',
	'questionsPanel.empty': 'Пока нет вопросов.',
	'questionsPanel.adding': 'Добавление…',
	'questionsPanel.addQuestion': 'Добавить вопрос',
	'questionsPanel.typeText': 'Текст',
	'questionsPanel.typeCheckbox': 'Чекбокс (да/нет)',
	'questionsPanel.typeSelect': 'Выпадающий список',
	'questionsPanel.delete.title': 'Удалить вопрос?',
	'questionsPanel.delete.description': 'Вопрос «{label}» будет удалён из формы бронирования этого типа событий.',
	'questionsPanel.errors.load': 'Не удалось загрузить вопросы',
	'questionsPanel.errors.add': 'Не удалось добавить вопрос',
	'questionsPanel.errors.save': 'Не удалось сохранить вопрос',
	'questionsPanel.errors.delete': 'Не удалось удалить вопрос',
	'questionsPanel.errors.labelRequired': 'Укажите название.',
	'questionsPanel.errors.optionRequired': 'Добавьте хотя бы один вариант.',
	'questionsPanel.errors.optionRequiredDropdown': 'Для выпадающего списка добавьте хотя бы один вариант.'
};
