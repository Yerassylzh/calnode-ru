// Catalog for the auth module. Keys MUST be prefixed with "auth."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	// Shared labels / messages
	'auth.email': 'Email',
	'auth.password': 'Password',
	'auth.fullName': 'Full name',
	'auth.minCharacters': 'Minimum 8 characters',
	'auth.creatingAccount': 'Creating account…',
	'auth.sending': 'Sending…',
	'auth.invalidEmail': 'Enter a valid email address first.',

	// Login
	'auth.login.title': 'Sign in — Calnode',
	'auth.login.heading': 'Sign in to Calnode',
	'auth.login.oauthState': 'Login failed: invalid session state. Please try again.',
	'auth.login.oauthDenied': 'You denied access. Sign in is required to use the admin.',
	'auth.login.oauthError': 'OAuth error. Please try again.',
	'auth.login.oauthUserinfo': 'Could not fetch your profile. Please try again.',
	'auth.login.oauthNoAccount': 'No Calnode account found for your email. Contact your admin.',
	'auth.login.oauthArchived':
		'Your account has been archived. If you think this is an error, please contact your workspace admin.',
	'auth.login.oauthSession': 'Could not create a session. Please try again.',
	'auth.login.oauthLink': 'This login link is invalid or has expired. Request a new one below.',
	'auth.login.errorGeneric': 'An error occurred. Please try again.',
	'auth.login.enteringDemo': 'Entering demo…',
	'auth.login.withGoogle': 'Sign in with Google',
	'auth.login.withMicrosoft': 'Sign in with Microsoft',
	'auth.login.or': 'or',
	'auth.login.forgotLink': 'Forgot password?',
	'auth.login.submitting': 'Signing in…',
	'auth.login.submit': 'Sign in',
	'auth.login.magicSubmit': 'Email me a login link',
	'auth.login.magicSent': 'If an account with that email exists, a login link is on its way.',
	'auth.login.magicHelp': 'A one-time sign-in link, no password needed.',
	'auth.login.noMethods': 'No login methods are configured. Contact your administrator.',
	'auth.login.failedGeneric': 'Login failed. Please try again.',

	// Forgot password
	'auth.forgot.title': 'Forgot password — Calnode',
	'auth.forgot.heading': 'Forgot your password?',
	'auth.forgot.description':
		"Enter your account email and we'll send you a link to set a new password.",
	'auth.forgot.backToSignIn': 'Back to sign in',
	'auth.forgot.submit': 'Send reset link',
	'auth.forgot.sent':
		'If an account with that email exists, a password-reset link is on its way.',

	// Reset password
	'auth.reset.title': 'Set a new password — Calnode',
	'auth.reset.missingToken': 'This reset link is missing its token. Request a new one below.',
	'auth.reset.tooShort': 'Password must be at least 8 characters.',
	'auth.reset.mismatch': 'The two passwords do not match.',
	'auth.reset.failedExpired': 'Could not reset your password. The link may have expired.',
	'auth.reset.failed': 'Could not reset your password. Please try again.',
	'auth.reset.heading': 'Set a new password',
	'auth.reset.description': 'Choose a password of at least 8 characters.',
	'auth.reset.requestNew': 'Request a new reset link',
	'auth.reset.newPassword': 'New password',
	'auth.reset.confirmPassword': 'Confirm new password',
	'auth.reset.submitting': 'Setting…',
	'auth.reset.submit': 'Set new password',

	// Claim (first-run owner setup)
	'auth.claim.title': 'Set up Calnode',
	'auth.claim.heading': 'Welcome to Calnode',
	'auth.claim.subheading': "You're the first here — create your owner account.",
	'auth.claim.failed': 'Setup failed. Please try again.',
	'auth.claim.submit': 'Create owner account',

	// Invite acceptance
	'auth.invite.title': 'Accept invite — Calnode',
	'auth.invite.heading': "You've been invited",
	'auth.invite.checking': 'Checking your invite…',
	'auth.invite.invalid':
		'This invite link has expired or already been used. Ask your admin to send a new one.',
	'auth.invite.for': 'This invite is for',
	'auth.invite.notTransferable': 'It cannot be used by anyone else.',
	'auth.invite.failed': 'Could not complete setup. Please try again.',
	'auth.invite.submit': 'Create account'
};

export const ru: Record<string, CatalogEntry> = {
	// Общие подписи и сообщения
	'auth.email': 'Email',
	'auth.password': 'Пароль',
	'auth.fullName': 'Полное имя',
	'auth.minCharacters': 'Минимум 8 символов',
	'auth.creatingAccount': 'Создание учётной записи…',
	'auth.sending': 'Отправка…',
	'auth.invalidEmail': 'Сначала укажите корректный адрес электронной почты.',

	// Вход
	'auth.login.title': 'Вход — Calnode',
	'auth.login.heading': 'Вход в Calnode',
	'auth.login.oauthState': 'Не удалось выполнить вход: недействительное состояние сессии. Попробуйте ещё раз.',
	'auth.login.oauthDenied': 'Вы отказали в доступе. Для работы с панелью управления требуется вход.',
	'auth.login.oauthError': 'Ошибка OAuth. Попробуйте ещё раз.',
	'auth.login.oauthUserinfo': 'Не удалось получить ваш профиль. Попробуйте ещё раз.',
	'auth.login.oauthNoAccount': 'Учётная запись Calnode для вашего email не найдена. Обратитесь к администратору.',
	'auth.login.oauthArchived':
		'Ваша учётная запись заархивирована. Если вы считаете, что это ошибка, обратитесь к администратору рабочего пространства.',
	'auth.login.oauthSession': 'Не удалось создать сессию. Попробуйте ещё раз.',
	'auth.login.oauthLink': 'Эта ссылка для входа недействительна или срок её действия истёк. Запросите новую ниже.',
	'auth.login.errorGeneric': 'Произошла ошибка. Попробуйте ещё раз.',
	'auth.login.enteringDemo': 'Переход в демо-режим…',
	'auth.login.withGoogle': 'Войти через Google',
	'auth.login.withMicrosoft': 'Войти через Microsoft',
	'auth.login.or': 'или',
	'auth.login.forgotLink': 'Забыли пароль?',
	'auth.login.submitting': 'Вход…',
	'auth.login.submit': 'Войти',
	'auth.login.magicSubmit': 'Отправить ссылку для входа на email',
	'auth.login.magicSent': 'Если учётная запись с таким email существует, ссылка для входа уже в пути.',
	'auth.login.magicHelp': 'Одноразовая ссылка для входа — пароль не требуется.',
	'auth.login.noMethods': 'Способы входа не настроены. Обратитесь к администратору.',
	'auth.login.failedGeneric': 'Не удалось выполнить вход. Попробуйте ещё раз.',

	// Восстановление пароля
	'auth.forgot.title': 'Восстановление пароля — Calnode',
	'auth.forgot.heading': 'Забыли пароль?',
	'auth.forgot.description':
		'Укажите email вашей учётной записи, и мы отправим вам ссылку для установки нового пароля.',
	'auth.forgot.backToSignIn': 'Вернуться к входу',
	'auth.forgot.submit': 'Отправить ссылку для сброса',
	'auth.forgot.sent': 'Если учётная запись с таким email существует, ссылка для сброса пароля уже в пути.',

	// Установка нового пароля
	'auth.reset.title': 'Установка нового пароля — Calnode',
	'auth.reset.missingToken': 'В ссылке для сброса отсутствует токен. Запросите новую ссылку ниже.',
	'auth.reset.tooShort': 'Пароль должен содержать не менее 8 символов.',
	'auth.reset.mismatch': 'Введённые пароли не совпадают.',
	'auth.reset.failedExpired': 'Не удалось сбросить пароль. Возможно, срок действия ссылки истёк.',
	'auth.reset.failed': 'Не удалось сбросить пароль. Попробуйте ещё раз.',
	'auth.reset.heading': 'Установите новый пароль',
	'auth.reset.description': 'Выберите пароль длиной не менее 8 символов.',
	'auth.reset.requestNew': 'Запросить новую ссылку для сброса',
	'auth.reset.newPassword': 'Новый пароль',
	'auth.reset.confirmPassword': 'Подтвердите новый пароль',
	'auth.reset.submitting': 'Установка…',
	'auth.reset.submit': 'Установить новый пароль',

	// Первоначальная настройка (владелец)
	'auth.claim.title': 'Настройка Calnode',
	'auth.claim.heading': 'Добро пожаловать в Calnode',
	'auth.claim.subheading': 'Вы здесь первый — создайте свою учётную запись владельца.',
	'auth.claim.failed': 'Не удалось выполнить настройку. Попробуйте ещё раз.',
	'auth.claim.submit': 'Создать учётную запись владельца',

	// Принятие приглашения
	'auth.invite.title': 'Принять приглашение — Calnode',
	'auth.invite.heading': 'Вас пригласили',
	'auth.invite.checking': 'Проверяем ваше приглашение…',
	'auth.invite.invalid':
		'Срок действия этой ссылки-приглашения истёк или она уже была использована. Попросите администратора отправить новую.',
	'auth.invite.for': 'Это приглашение для',
	'auth.invite.notTransferable': 'Оно не может быть использовано кем-то другим.',
	'auth.invite.failed': 'Не удалось завершить настройку. Попробуйте ещё раз.',
	'auth.invite.submit': 'Создать учётную запись'
};
