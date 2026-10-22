// Catalog for the embedPanel module. Keys MUST be prefixed with "embedPanel."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'embedPanel.heading': 'Embed',
	// Sentence split around a literal <code></body></code> rendered in markup.
	'embedPanel.intro': 'Drop this booking widget on your website — it renders inline, no iframe. Paste before',
	'embedPanel.inline.label': 'Inline',
	'embedPanel.inline.hint': 'Embeds the booking calendar directly in the page.',
	'embedPanel.popup.label': 'Popup button',
	'embedPanel.popup.hint': 'A button that opens the booking widget in a modal.',
	'embedPanel.copied': 'Copied!',
	'embedPanel.clipboardError': 'Could not copy to clipboard',
	// Sentence split around a literal <code>EMBED_ALLOWED_ORIGINS</code> rendered in markup.
	'embedPanel.apiNote': "The widget calls this instance's public booking API. To restrict which sites may embed it, set"
};

export const ru: Record<string, CatalogEntry> = {
	'embedPanel.heading': 'Встраивание',
	'embedPanel.intro': 'Разместите этот виджет бронирования на своём сайте — он отображается прямо на странице, без iframe. Вставьте код перед',
	'embedPanel.inline.label': 'Встроенный',
	'embedPanel.inline.hint': 'Встраивает календарь бронирования прямо в страницу.',
	'embedPanel.popup.label': 'Кнопка во всплывающем окне',
	'embedPanel.popup.hint': 'Кнопка, открывающая виджет бронирования в модальном окне.',
	'embedPanel.copied': 'Скопировано!',
	'embedPanel.clipboardError': 'Не удалось скопировать в буфер обмена',
	'embedPanel.apiNote': 'Виджет обращается к публичному API бронирования этого инстанса. Чтобы ограничить список сайтов, которым разрешено встраивание, задайте'
};
