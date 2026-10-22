// Catalog for the members module. Keys MUST be prefixed with "members."
// en and ru must define exactly the same key set (enforced by parity checks).
import type { CatalogEntry } from '../index';

export const en: Record<string, CatalogEntry> = {
	'members.pageTitle': 'Members — Calnode',
	'members.heading': 'Members',
	'members.subtitle': 'Manage workspace members, roles, and invites.',

	'members.invite.open': 'Invite member',
	'members.invite.title': 'Invite a member',
	'members.invite.generated': 'Invite link generated',
	'members.invite.emailSent': 'An invite email has been sent to {email}.',
	'members.invite.noSmtp': 'SMTP is not configured — share this link directly with {email}.',
	'members.invite.emailLabel': 'Email address',
	'members.invite.generate': 'Generate invite link',
	'members.invite.generating': 'Generating…',
	'members.invite.errorRequired': 'Email is required.',
	'members.invite.revokeTitle': 'Revoke invite?',
	'members.invite.revokeDescription': 'The link will stop working immediately.',
	'members.invite.revoke': 'Revoke',
	'members.invite.resent': 'Invite re-sent to {email}',
	'members.invite.newLink': 'New link generated for {email}',
	'members.invite.resendFailed': 'Could not resend invite',
	'members.invite.noSmtpNote': 'Email is not configured — copy this link and send it manually.',

	'members.role.owner': 'Owner',
	'members.role.admin': 'Admin',
	'members.role.member': 'Member',
	'members.role.nowAdmin': '{name} is now an admin',
	'members.role.nowMember': '{name} is now a member',
	'members.role.changeFailed': 'Could not change role',

	'members.transfer.title': 'Transfer ownership to {name}?',
	'members.transfer.description': 'You will become an admin and they become the workspace owner. Only the owner can do this.',
	'members.transfer.action': 'Transfer ownership',
	'members.transfer.success': '{name} is now the owner',
	'members.transfer.failed': 'Could not transfer ownership',

	'members.archive.title': 'Archive {name}?',
	'members.archive.description': 'They lose access immediately and their event types are deactivated. Their record and history are kept — you can restore them later.',
	'members.archive.action': 'Archive',
	'members.archive.success': 'Member archived',
	'members.archive.failed': 'Could not archive member',

	'members.restore.action': 'Restore',
	'members.restore.success': '{name} restored',
	'members.restore.failed': 'Could not restore member',

	'members.resolve.title': 'Resolve {name}\'s upcoming meetings',
	'members.resolve.countdown': { one: '{count} upcoming meeting remaining.', other: '{count} upcoming meetings remaining.' },
	'members.resolve.instructions': 'Reassign each to another member or cancel it. When all are resolved, the member is archived automatically.',
	'members.resolve.attendeeFallback': 'attendee',
	'members.resolve.reassignTo': 'Reassign to…',
	'members.resolve.reassign': 'Reassign',
	'members.resolve.cancelMeeting': 'Cancel meeting',
	'members.resolve.noTargets': 'No other active members to reassign to — meetings can only be cancelled.',
	'members.resolve.cancelAll': 'Cancel all remaining',
	'members.resolve.doneLater': 'Done later',

	'members.reset.errorRequired': 'Password is required.',
	'members.reset.success': 'Password updated',
	'members.reset.placeholder': 'New password',
	'members.reset.set': 'Set',
	'members.reset.action': 'Reset password',

	'members.auth.email': 'Email',

	'members.showArchived': 'Show archived',
	'members.hideArchived': 'Hide archived',
	'members.empty': 'No members yet.',
	'members.you': '(you)',
	'members.badgeArchived': 'Archived',
	'members.noPublicPage': 'No public page — set a handle in their profile',
	'members.archivedBy': 'Archived by {name}',

	'members.col.name': 'Name',
	'members.col.role': 'Role',
	'members.col.teams': 'Teams',
	'members.col.page': 'Page',
	'members.col.auth': 'Auth',
	'members.col.joined': 'Joined',
	'members.col.email': 'Email',
	'members.col.expires': 'Expires',

	'members.invites.heading': 'Pending Invites',
	'members.invites.daysLeft': { one: '{count}d left', other: '{count}d left' },
	'members.invites.resend': 'Resend',
	'members.invites.resendNote': 'Resend mints a fresh link, resets the 7-day expiry, and re-emails it — the previous link stops working.',

	'members.actions.makeMember': 'Make member',
	'members.actions.makeAdmin': 'Make admin'
};

export const ru: Record<string, CatalogEntry> = {
	'members.pageTitle': 'Участники — Calnode',
	'members.heading': 'Участники',
	'members.subtitle': 'Управляйте участниками рабочего пространства, ролями и приглашениями.',

	'members.invite.open': 'Пригласить участника',
	'members.invite.title': 'Приглашение участника',
	'members.invite.generated': 'Ссылка для приглашения создана',
	'members.invite.emailSent': 'Письмо с приглашением отправлено на {email}.',
	'members.invite.noSmtp': 'SMTP не настроен — отправьте эту ссылку участнику {email} напрямую.',
	'members.invite.emailLabel': 'Адрес электронной почты',
	'members.invite.generate': 'Создать ссылку для приглашения',
	'members.invite.generating': 'Создание…',
	'members.invite.errorRequired': 'Укажите адрес электронной почты.',
	'members.invite.revokeTitle': 'Отозвать приглашение?',
	'members.invite.revokeDescription': 'Ссылка перестанет работать сразу.',
	'members.invite.revoke': 'Отозвать',
	'members.invite.resent': 'Приглашение повторно отправлено на {email}',
	'members.invite.newLink': 'Новая ссылка создана для {email}',
	'members.invite.resendFailed': 'Не удалось повторно отправить приглашение',
	'members.invite.noSmtpNote': 'Почта не настроена — скопируйте эту ссылку и отправьте её вручную.',

	'members.role.owner': 'Владелец',
	'members.role.admin': 'Администратор',
	'members.role.member': 'Участник',
	'members.role.nowAdmin': '{name} теперь администратор',
	'members.role.nowMember': '{name} теперь участник',
	'members.role.changeFailed': 'Не удалось изменить роль',

	'members.transfer.title': 'Передать владение участнику {name}?',
	'members.transfer.description': 'Вы станете администратором, а этот участник — владельцем рабочего пространства. Это может сделать только владелец.',
	'members.transfer.action': 'Передать владение',
	'members.transfer.success': '{name} теперь владелец',
	'members.transfer.failed': 'Не удалось передать владение',

	'members.archive.title': 'Архивировать участника {name}?',
	'members.archive.description': 'Участник сразу теряет доступ, а его типы событий деактивируются. Запись и история сохраняются — позже его можно восстановить.',
	'members.archive.action': 'Архивировать',
	'members.archive.success': 'Участник архивирован',
	'members.archive.failed': 'Не удалось архивировать участника',

	'members.restore.action': 'Восстановить',
	'members.restore.success': '{name} восстановлен',
	'members.restore.failed': 'Не удалось восстановить участника',

	'members.resolve.title': 'Предстоящие встречи участника {name}',
	'members.resolve.countdown': {
		one: 'Осталась {count} предстоящая встреча.',
		few: 'Осталось {count} предстоящие встречи.',
		many: 'Осталось {count} предстоящих встреч.',
		other: 'Осталось {count} предстоящих встреч.'
	},
	'members.resolve.instructions': 'Переназначьте каждую встречу другому участнику или отмените её. Когда все встречи обработаны, участник будет архивирован автоматически.',
	'members.resolve.attendeeFallback': 'участник',
	'members.resolve.reassignTo': 'Переназначить…',
	'members.resolve.reassign': 'Переназначить',
	'members.resolve.cancelMeeting': 'Отменить встречу',
	'members.resolve.noTargets': 'Нет других активных участников для переназначения — встречи можно только отменить.',
	'members.resolve.cancelAll': 'Отменить все оставшиеся',
	'members.resolve.doneLater': 'Завершить позже',

	'members.reset.errorRequired': 'Укажите пароль.',
	'members.reset.success': 'Пароль обновлён',
	'members.reset.placeholder': 'Новый пароль',
	'members.reset.set': 'Задать',
	'members.reset.action': 'Сбросить пароль',

	'members.auth.email': 'Почта',

	'members.showArchived': 'Показать архивированных',
	'members.hideArchived': 'Скрыть архивированных',
	'members.empty': 'Пока нет участников.',
	'members.you': '(это вы)',
	'members.badgeArchived': 'Архивирован',
	'members.noPublicPage': 'Нет публичной страницы — задайте имя пользователя в его профиле',
	'members.archivedBy': 'Архивировал: {name}',

	'members.col.name': 'Имя',
	'members.col.role': 'Роль',
	'members.col.teams': 'Команды',
	'members.col.page': 'Страница',
	'members.col.auth': 'Вход',
	'members.col.joined': 'Дата регистрации',
	'members.col.email': 'Эл. почта',
	'members.col.expires': 'Истекает',

	'members.invites.heading': 'Ожидающие приглашения',
	'members.invites.daysLeft': {
		one: 'осталось {count} дн.',
		few: 'осталось {count} дн.',
		many: 'осталось {count} дн.',
		other: 'осталось {count} дн.'
	},
	'members.invites.resend': 'Отправить снова',
	'members.invites.resendNote': '«Отправить снова» создаёт новую ссылку, сбрасывает 7-дневный срок действия и повторно отправляет письмо — прежняя ссылка перестаёт работать.',

	'members.actions.makeMember': 'Сделать участником',
	'members.actions.makeAdmin': 'Сделать администратором'
};
