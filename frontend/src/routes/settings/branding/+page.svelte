<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';
	import type CropperType from 'cropperjs';

	type Branding = {
		business_name: string;
		logo_url: string;
		logo_height: number;
		logo_opacity: number;
		banner_url: string;
		banner_opacity: number;
		privacy_url: string;
		terms_url: string;
		fallback_locale: string;
		supported_locales: { code: string; name: string }[];
	};

	// Both logo and banner share the same upload/crop dialog; cropTarget picks
	// which endpoint + field name cropAndUpload() posts to.
	type CropTarget = 'logo' | 'banner';

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();
	const uploadingFlag = createAsyncFlag();
	let businessName = $state('');
	let logoUrl = $state('');
	let logoHeight = $state(28);
	let logoOpacity = $state(100);
	let bannerUrl = $state('');
	let bannerOpacity = $state(100);
	let privacyUrl = $state('');
	let termsUrl = $state('');
	let fallbackLocale = $state('en');
	let supportedLocales = $state<{ code: string; name: string }[]>([]);
	let fileInput = $state<HTMLInputElement | undefined>();
	let bannerFileInput = $state<HTMLInputElement | undefined>();

	// Crop dialog — Cropper is lazy-loaded client-side only to avoid SSR failures.
	let cropOpen = $state(false);
	let cropSrc = $state('');
	let cropTarget = $state<CropTarget>('logo');
	let cropperEl = $state<HTMLImageElement | undefined>();
	let cropperInstance: CropperType | null = null;
	let CropperClass: typeof CropperType | null = null;

	$effect(() => {
		if (!cropperEl || !CropperClass) return;
		// Free-form crop (aspectRatio NaN) with the whole image selected by default,
		// so cropping is optional — the user can adjust or just Save the full image.
		const c = new CropperClass(cropperEl, {
			aspectRatio: NaN,
			viewMode: 1,
			autoCropArea: 1,
			movable: true,
			zoomable: true,
			rotatable: false,
			scalable: false,
			background: true
		});
		cropperInstance = c;
		return () => { c.destroy(); cropperInstance = null; };
	});

	onMount(() => loadingFlag.run(async () => {
		const b = await api.get<Branding>('/v1/settings/branding');
		businessName = b.business_name ?? '';
		logoUrl = b.logo_url ?? '';
		logoHeight = b.logo_height || 28;
		logoOpacity = b.logo_opacity || 100;
		bannerUrl = b.banner_url ?? '';
		bannerOpacity = b.banner_opacity || 100;
		privacyUrl = b.privacy_url ?? '';
		termsUrl = b.terms_url ?? '';
		fallbackLocale = b.fallback_locale || 'en';
		supportedLocales = b.supported_locales ?? [];
	}, $t('settingsBranding.loadFailed')));

	async function onFileChange(target: CropTarget) {
		const input = target === 'logo' ? fileInput : bannerFileInput;
		const file = input?.files?.[0];
		if (!file) return;
		if (!CropperClass) {
			const [mod] = await Promise.all([
				import('cropperjs'),
				import('cropperjs/dist/cropper.min.css')
			]);
			CropperClass = mod.default;
		}
		cropTarget = target;
		const reader = new FileReader();
		reader.onload = (e) => {
			cropSrc = e.target?.result as string;
			cropOpen = true;
		};
		reader.readAsDataURL(file);
	}

	function cancelCrop() {
		cropOpen = false;
		cropSrc = '';
		if (fileInput) fileInput.value = '';
		if (bannerFileInput) bannerFileInput.value = '';
	}

	async function cropAndUpload() {
		if (!cropperInstance) return;
		const target = cropTarget;
		await uploadingFlag.run(async () => {
			const canvas = cropperInstance!.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 });
			const blob = await new Promise<Blob>((resolve, reject) =>
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error($t('settingsBranding.canvasExportFailed')))), 'image/png')
			);
			const data = new FormData();
			data.append(target, blob, `${target}.png`);
			if (target === 'logo') {
				const res = await api.postForm<{ logo_url: string }>('/v1/settings/branding/logo', data);
				logoUrl = res.logo_url;
			} else {
				const res = await api.postForm<{ banner_url: string }>('/v1/settings/branding/banner', data);
				bannerUrl = res.banner_url;
			}
			cropOpen = false;
			cropSrc = '';
			if (fileInput) fileInput.value = '';
			if (bannerFileInput) bannerFileInput.value = '';
			toast.success(target === 'logo' ? $t('settingsBranding.logoUploaded') : $t('settingsBranding.bannerUploaded'));
		}, target === 'logo' ? $t('settingsBranding.uploadFailedLogo') : $t('settingsBranding.uploadFailedBanner'));
	}

	async function removeLogo() {
		try {
			await api.del('/v1/settings/branding/logo');
			logoUrl = '';
			toast.success($t('settingsBranding.logoRemoved'));
		} catch (e: any) {
			toast.error(e.message || $t('settingsBranding.removeLogoFailed'));
		}
	}

	async function removeBanner() {
		try {
			await api.del('/v1/settings/branding/banner');
			bannerUrl = '';
			toast.success($t('settingsBranding.bannerRemoved'));
		} catch (e: any) {
			toast.error(e.message || $t('settingsBranding.removeBannerFailed'));
		}
	}

	async function save() {
		await savingFlag.run(async () => {
			const b = await api.patch<Branding>('/v1/settings/branding', {
				business_name: businessName,
				logo_height: logoHeight,
				logo_opacity: logoOpacity,
				banner_opacity: bannerOpacity,
				privacy_url: privacyUrl,
				terms_url: termsUrl,
				fallback_locale: fallbackLocale
			});
			businessName = b.business_name ?? '';
			logoHeight = b.logo_height || 28;
			logoOpacity = b.logo_opacity || 100;
			bannerOpacity = b.banner_opacity || 100;
			privacyUrl = b.privacy_url ?? '';
			termsUrl = b.terms_url ?? '';
			fallbackLocale = b.fallback_locale || 'en';
			toast.success($t('settingsBranding.saved'));
		}, $t('settingsBranding.saveFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsBranding.adminRequired')}</p>
{:else if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-2xl space-y-6">
		<div class="rounded-lg border bg-card p-6">
			<h2 class="text-sm font-semibold">{$t('settingsBranding.brandingTitle')}</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">
				{$t('settingsBranding.brandingDescription')}
			</p>

			<div class="mt-4 space-y-1.5">
				<Label for="business-name">{$t('settingsBranding.businessName')}</Label>
				<Input id="business-name" bind:value={businessName} placeholder="Orchestratr" maxlength={200} />
				<p class="text-xs text-muted-foreground">{$t('settingsBranding.businessNameHint')}</p>
			</div>

			<div class="mt-5 space-y-3">
				<Label>{$t('settingsBranding.logo')}</Label>
				<input bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" onchange={() => onFileChange('logo')} />
				<button
					type="button"
					onclick={() => fileInput?.click()}
					disabled={uploadingFlag.active}
					title={logoUrl ? $t('settingsBranding.replaceLogo') : $t('settingsBranding.uploadLogo')}
					class="group relative flex min-h-[88px] w-full max-w-md cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-white px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait"
				>
					{#if logoUrl}
						<img src={logoUrl} alt={$t('settingsBranding.altLogo')} style="height:{logoHeight}px;width:auto;opacity:{logoOpacity / 100};" />
					{:else}
						<span class="text-sm text-muted-foreground">{$t('settingsBranding.clickUploadLogo')}</span>
					{/if}
					<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
					</div>
				</button>

				{#if logoUrl}
					<div class="max-w-md space-y-3">
						<div class="flex items-center gap-3">
							<span class="w-14 text-xs font-medium text-muted-foreground">{$t('settingsBranding.size')}</span>
							<input type="range" min="16" max="64" step="1" bind:value={logoHeight} class="flex-1 accent-primary" />
							<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{logoHeight}px</span>
						</div>
						<div class="flex items-center gap-3">
							<span class="w-14 text-xs font-medium text-muted-foreground">{$t('settingsBranding.opacity')}</span>
							<input type="range" min="20" max="100" step="1" bind:value={logoOpacity} class="flex-1 accent-primary" />
							<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{logoOpacity}%</span>
						</div>
						<Button type="button" variant="ghost" size="sm" onclick={removeLogo} class="text-destructive hover:text-destructive">{$t('settingsBranding.removeLogoButton')}</Button>
					</div>
				{/if}

				<p class="text-xs text-muted-foreground">
					{$t('settingsBranding.logoHint')}
				</p>
			</div>

			<div class="mt-6 space-y-3 border-t pt-5">
				<Label>{$t('settingsBranding.banner')}</Label>
				<input bind:this={bannerFileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" onchange={() => onFileChange('banner')} />
				<button
					type="button"
					onclick={() => bannerFileInput?.click()}
					disabled={uploadingFlag.active}
					title={bannerUrl ? $t('settingsBranding.replaceBanner') : $t('settingsBranding.uploadBanner')}
					class="group relative flex min-h-[88px] w-full max-w-md cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-white px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait"
				>
					{#if bannerUrl}
						<img src={bannerUrl} alt={$t('settingsBranding.altBanner')} style="width:100%;height:auto;opacity:{bannerOpacity / 100};" />
					{:else}
						<span class="text-sm text-muted-foreground">{$t('settingsBranding.clickUploadBanner')}</span>
					{/if}
					<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
					</div>
				</button>

				{#if bannerUrl}
					<div class="max-w-md space-y-3">
						<div class="flex items-center gap-3">
							<span class="w-14 text-xs font-medium text-muted-foreground">{$t('settingsBranding.opacity')}</span>
							<input type="range" min="20" max="100" step="1" bind:value={bannerOpacity} class="flex-1 accent-primary" />
							<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{bannerOpacity}%</span>
						</div>
						<Button type="button" variant="ghost" size="sm" onclick={removeBanner} class="text-destructive hover:text-destructive">{$t('settingsBranding.removeBannerButton')}</Button>
					</div>
				{/if}

				<p class="text-xs text-muted-foreground">
					{$t('settingsBranding.bannerHint')}
				</p>
			</div>
		</div>

		<div class="rounded-lg border bg-card p-6">
			<h2 class="text-sm font-semibold">{$t('settingsBranding.legalTitle')}</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">
				{$t('settingsBranding.legalDescription')}
			</p>

			<div class="mt-4 space-y-1.5">
				<Label for="privacy-url">{$t('settingsBranding.privacyUrl')}</Label>
				<Input id="privacy-url" type="url" bind:value={privacyUrl} placeholder="https://example.com/privacy" maxlength={500} />
			</div>

			<div class="mt-4 space-y-1.5">
				<Label for="terms-url">{$t('settingsBranding.termsUrl')}</Label>
				<Input id="terms-url" type="url" bind:value={termsUrl} placeholder="https://example.com/terms" maxlength={500} />
				<p class="text-xs text-muted-foreground">{$t('settingsBranding.legalHint')}</p>
			</div>
		</div>

		{#if supportedLocales.length > 1}
			<div class="rounded-lg border bg-card p-6">
				<h2 class="text-sm font-semibold">{$t('common.language')}</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{$t('settingsBranding.languageDescription')}
				</p>
				<div class="mt-4 max-w-xs space-y-1.5">
					<Label for="fallback-locale">{$t('settingsBranding.fallbackLanguage')}</Label>
					<Select.Root
						type="single"
						value={fallbackLocale}
						onValueChange={(v) => { if (v) fallbackLocale = v; }}
					>
						<Select.Trigger id="fallback-locale" class="w-full">
							{supportedLocales.find((l) => l.code === fallbackLocale)?.name ?? $t('common.select')}
						</Select.Trigger>
						<Select.Content>
							{#each supportedLocales as loc}
								<Select.Item value={loc.code} label={loc.name}>{loc.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
		{/if}

		<Button onclick={save} disabled={savingFlag.active}>{savingFlag.active ? $t('common.saving') : $t('common.save')}</Button>
	</div>

	<Dialog.Root bind:open={cropOpen} onOpenChange={(o) => { if (!o) cancelCrop(); }}>
		<Dialog.Content class="max-w-lg">
			<Dialog.Header>
				<Dialog.Title>{cropTarget === 'logo' ? $t('settingsBranding.cropLogo') : $t('settingsBranding.cropBanner')}</Dialog.Title>
				<Dialog.Description>{$t('settingsBranding.cropDescription')}</Dialog.Description>
			</Dialog.Header>
			<div class="mt-2 overflow-hidden rounded-md bg-muted" style="max-height: 360px;">
				{#if cropSrc}
					<img bind:this={cropperEl} src={cropSrc} alt={$t('settingsBranding.altCropPreview')} class="block max-w-full" />
				{/if}
			</div>
			<Dialog.Footer class="mt-4">
				<Button variant="outline" onclick={cancelCrop} disabled={uploadingFlag.active}>{$t('common.cancel')}</Button>
				<Button onclick={cropAndUpload} disabled={uploadingFlag.active}>{uploadingFlag.active ? $t('settingsBranding.uploading') : cropTarget === 'logo' ? $t('settingsBranding.saveLogo') : $t('settingsBranding.saveBanner')}</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
