// Legacy URL kept alive for old bookmarks and for the Go-side redirects
// (OAuth callbacks, /admin/breaks, /admin/event-types) that still point here.
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load = () => {
	redirect(307, base + '/');
};
