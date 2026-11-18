// Tolerant phone entry: people paste "+7 (701) 123-45-67", "8 701 123 45 67" or "7011234567".
// The API wants E.164 (`+` and 7-15 digits, first digit 1-9), so normalise before validating.

export const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;

export function normalizePhone(input: string, defaultCountry = '7'): string {
	const trimmed = input.trim();
	if (!trimmed) return '';
	let digits = trimmed.replace(/\D/g, '');
	if (!digits) return '';
	if (trimmed.startsWith('+')) return '+' + digits;
	if (digits.startsWith('00')) return '+' + digits.slice(2);
	// Trunk prefix 8 on an 11-digit national number (RU/KZ habit).
	if (digits.length === 11 && digits.startsWith('8') && defaultCountry === '7') digits = '7' + digits.slice(1);
	// A bare 10-digit national number gets the default country code.
	if (digits.length === 10) digits = defaultCountry + digits;
	return '+' + digits;
}

export const isValidPhone = (value: string) => PHONE_PATTERN.test(value);
