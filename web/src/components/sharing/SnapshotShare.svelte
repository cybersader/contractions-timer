<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getStoredSignalingUrl } from '../../lib/p2p/quick-connect';
	import {
		compressSession, decompressSession,
		generateSnapshotUrl, extractSnapshotCode,
		postSnapshotToRelay, getSnapshotFromRelay,
		isQRCompatible, previewSnapshot,
		type SnapshotPreview, type DecompressedSnapshot,
	} from '../../lib/p2p/snapshot-share';
	import { extractSharedSettings, filterSettingsByCategories, detectIncludedCategories } from '../../lib/p2p/compact-codec';
	import { QRCodeToDataURL } from '../../lib/p2p/qr';
	import { archiveSession } from '../../lib/storage';
	import { deepMerge } from '../../lib/labor-logic/deepMerge';
	import type { SessionData, ContractionTimerSettings, SharingCategory, SharingPreferences } from '../../lib/labor-logic/types';
	import { SHARING_CATEGORY_LABELS, DEFAULT_SHARING_PREFERENCES } from '../../lib/labor-logic/types';
	import { Copy, Link, Hash, QrCode, Download, Loader2, Camera, Info, ClipboardPaste, Archive, Share2, ChevronRight, Settings2, ChevronDown, ChevronUp } from 'lucide-svelte';
	import jsQR from 'jsqr';
	import { dlog } from '../../lib/debug-log';
	import { _ } from 'svelte-i18n';

	interface Props {
		/** Called when user imports a snapshot, with the decompressed session data */
		onImport?: (session: SessionData) => void;
		/** Pre-filled snapshot code from URL parameter */
		initialSnapshotCode?: string | null;
		/** Which section to render: 'send' = share buttons only, 'receive' = import only, 'both' = full component */
		mode?: 'send' | 'receive' | 'both';
	}
	let { onImport, initialSnapshotCode = null, mode = 'both' } = $props<Props>();

	const showSend = $derived(mode === 'send' || mode === 'both');
	const showReceive = $derived(mode === 'receive' || mode === 'both');

	// --- Sharing preferences (sender side) ---
	let showShareOptions = $state(false);
	let sharePrefs: SharingPreferences = $state({ ...$settings.sharingPreferences });

	// Persist sharing prefs back to settings store when they change
	$effect(() => {
		const current = { ...sharePrefs };
		settings.update(s => ({ ...s, sharingPreferences: current }));
	});

	// Invalidate compressed code when prefs change
	$effect(() => {
		void sharePrefs;
		compressedCode = '';
		shareState = 'idle';
	});

	// --- Send state ---
	let compressedCode = $state('');
	let shareState: 'idle' | 'compressing' | 'done' = $state('idle');
	let activeShareMethod: 'link' | 'data' | 'shortcode' | 'qr' | null = $state(null);
	let shortCode = $state('');
	let qrDataUrl = $state('');
	let copyFeedback = $state('');
	let shortCodeError = $state('');

	// --- Receive state ---
	let importInput = $state(initialSnapshotCode ?? '');
	let importState: 'idle' | 'loading' | 'preview' | 'error' = $state('idle');
	let importPreview: SnapshotPreview | null = $state(null);
	let importSession: SessionData | null = $state(null);
	let importSharedSettings: Partial<ContractionTimerSettings> | null = $state(null);
	let importCategories: Record<SharingCategory, boolean> = $state({
		thresholds: true, provider: true, layout: true,
		parity: true, travel: true, appearance: true,
	});
	let importError = $state('');

	// --- Derived ---
	const hasContractions = $derived($session.contractions.length > 0);

	/** Check if a suitable relay is configured for short codes (CF Worker, not ntfy.sh) */
	const relayUrl = $derived.by(() => {
		const url = getStoredSignalingUrl();
		// ntfy.sh doesn't support the /room/ API for snapshots
		if (!url || url === 'https://ntfy.sh') return '';
		return url;
	});
	const hasRelay = $derived(relayUrl.length > 0);

	/** Whether compressed data fits in a QR code */
	const qrAvailable = $derived(compressedCode.length > 0 && isQRCompatible(compressedCode));

	// --- Auto-import from URL parameter ---
	let autoImportAttempted = false;
	$effect(() => {
		if (initialSnapshotCode && !autoImportAttempted && importState === 'idle') {
			autoImportAttempted = true;
			handleImport();
		}
	});

	// --- Send handlers ---

	async function ensureCompressed(): Promise<string> {
		if (compressedCode) return compressedCode;
		shareState = 'compressing';
		try {
			const sharedSettings = extractSharedSettings($settings, sharePrefs);
			const code = await compressSession($session, sharedSettings);
			compressedCode = code;
			shareState = 'done';
			return code;
		} catch (e) {
			shareState = 'idle';
			throw e;
		}
	}

	async function handleCopyLink() {
		activeShareMethod = 'link';
		try {
			const code = await ensureCompressed();
			const url = generateSnapshotUrl(code);
			await copyToClipboard(url, 'Link');
		} catch (e) {
			console.error('[SnapshotShare] handleCopyLink failed:', e);
		} finally {
			activeShareMethod = null;
		}
	}

	async function handleCopyData() {
		activeShareMethod = 'data';
		try {
			const code = await ensureCompressed();
			await copyToClipboard(code, 'Data');
		} catch (e) {
			console.error('[SnapshotShare] handleCopyData failed:', e);
		} finally {
			activeShareMethod = null;
		}
	}

	async function handleShortCode() {
		if (!hasRelay) return;
		activeShareMethod = 'shortcode';
		shortCode = '';
		shortCodeError = '';
		try {
			const code = await ensureCompressed();
			const sc = await postSnapshotToRelay(code, relayUrl);
			shortCode = sc;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SnapshotShare] handleShortCode failed:', msg);
			shortCodeError = msg;
		} finally {
			activeShareMethod = null;
		}
	}

	let qrError = $state('');

	async function handleQrCode() {
		activeShareMethod = 'qr';
		qrDataUrl = '';
		qrError = '';
		try {
			const code = await ensureCompressed();
			if (!isQRCompatible(code)) {
				qrError = $_('sharing.snapshot.qrTooLargeError', { values: { charCount: code.length + 40 } });
				return;
			}
			const url = generateSnapshotUrl(code);
			qrDataUrl = await QRCodeToDataURL(url);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SnapshotShare] handleQrCode failed:', msg);
			qrError = $_('sharing.snapshot.qrGenerationFailed', { values: { message: msg } });
		} finally {
			activeShareMethod = null;
		}
	}

	/** Whether the Web Share API is available (typically mobile browsers) */
	const canNativeShare = $derived(typeof navigator !== 'undefined' && !!navigator.share);

	async function handleNativeShare() {
		try {
			const code = await ensureCompressed();
			const url = generateSnapshotUrl(code);
			await navigator.share({
				title: $_('sharing.snapshot.nativeShareTitle'),
				text: $_('sharing.snapshot.nativeShareText'),
				url,
			});
		} catch (e) {
			// User cancelled or share failed — ignore
			if (e instanceof Error && e.name !== 'AbortError') {
				console.error('[SnapshotShare] Native share failed:', e);
			}
		}
	}

	// --- Receive handlers ---

	async function handleImport() {
		const raw = importInput.trim();
		if (!raw) return;

		importState = 'loading';
		importError = '';
		importPreview = null;
		importSession = null;
		importSharedSettings = null;

		try {
			const parsed = extractSnapshotCode(raw);
			if (!parsed) {
				throw new Error($_('sharing.snapshot.importErrorUnrecognized'));
			}

			let dataCode: string;

			if (parsed.type === 'shortcode') {
				if (!hasRelay) {
					throw new Error($_('sharing.snapshot.importErrorRelayRequired'));
				}
				dataCode = await getSnapshotFromRelay(parsed.code, relayUrl);
			} else {
				dataCode = parsed.code;
			}

			const result = await decompressSession(dataCode);
			importSession = result.session;
			importSharedSettings = result.sharedSettings ?? null;

			// Reset category checkboxes — enable all categories that are present
			if (result.sharedSettings) {
				const present = detectIncludedCategories(result.sharedSettings);
				importCategories = {
					thresholds: present.includes('thresholds'),
					provider: present.includes('provider'),
					layout: present.includes('layout'),
					parity: present.includes('parity'),
					travel: present.includes('travel'),
					appearance: present.includes('appearance'),
				};
			}

			importPreview = previewSnapshot(result.session, result.sharedSettings);
			importState = 'preview';
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SnapshotShare] handleImport failed:', msg);
			importError = msg;
			importState = 'error';
		}
	}

	function handleConfirmImport(archiveFirst: boolean) {
		if (!importSession || !onImport) return;
		if (archiveFirst && hasContractions) {
			const count = $session.contractions.length;
			const label = `Before import (${count} contraction${count === 1 ? '' : 's'})`;
			archiveSession($session, label);
		}
		onImport(importSession);

		// Apply selected shared settings categories
		if (importSharedSettings) {
			const filtered = filterSettingsByCategories(importSharedSettings, importCategories);
			if (Object.keys(filtered).length > 0) {
				settings.update(s => deepMerge(s as Record<string, unknown>, filtered as Record<string, unknown>) as typeof s);
			}
		}

		// Reset state
		importInput = '';
		importState = 'idle';
		importPreview = null;
		importSession = null;
		importSharedSettings = null;
	}

	function handleCancelImport() {
		importState = 'idle';
		importPreview = null;
		importSession = null;
		importSharedSettings = null;
		importError = '';
	}

	async function handlePasteFromClipboard() {
		try {
			const text = await navigator.clipboard.readText();
			if (text) {
				importInput = text.trim();
				handleImport();
			}
		} catch {
			// Clipboard permission denied — ignore silently
		}
	}

	// --- Fullscreen QR viewer (tap to enlarge) ---
	let fullscreenQr = $state('');

	// --- QR Scanner (receive, jsQR-based for cross-browser support) ---
	let scanning = $state(false);
	let scanError = $state('');
	let scanVideoEl: HTMLVideoElement | undefined = $state();
	let scanCanvasEl: HTMLCanvasElement | undefined = $state();
	let scanStream: MediaStream | null = null;
	let scanTimer: ReturnType<typeof setTimeout> | null = null;

	/** Max canvas dimension for jsQR — keeps processing fast and avoids Safari blank-frame issues */
	const SCAN_MAX_DIM = 1024;

	/** Native BarcodeDetector (Safari iOS 17.2+, Chrome 83+) — bypasses canvas issues on mobile */
	let nativeBarcodeDetector: { detect(source: any): Promise<Array<{ rawValue: string }>> } | null = null;
	let barcodeDetectorChecked = false;

	async function initBarcodeDetector() {
		if (barcodeDetectorChecked) return;
		barcodeDetectorChecked = true;
		try {
			const BD = (globalThis as any).BarcodeDetector;
			dlog('qr-scan', 'BarcodeDetector exists?', !!BD);
			if (BD) {
				const formats: string[] = await BD.getSupportedFormats();
				dlog('qr-scan', 'Supported formats', formats);
				if (formats.includes('qr_code')) {
					nativeBarcodeDetector = new BD({ formats: ['qr_code'] });
					dlog('qr-scan', 'Using native BarcodeDetector');
				}
			}
		} catch (e) {
			dlog('qr-scan', 'BarcodeDetector init failed', String(e));
			nativeBarcodeDetector = null;
		}
	}

	async function startQRScan() {
		scanError = '';
		await initBarcodeDetector();
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error(
					window.isSecureContext === false
						? $_('sharing.cameraErrorHttps')
						: $_('sharing.cameraErrorUnavailable')
				);
			}

			let stream: MediaStream;
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
				});
			} catch {
				stream = await navigator.mediaDevices.getUserMedia({ video: true });
			}
			scanStream = stream;
			scanning = true;
			dlog('qr-scan', 'Got camera stream', { tracks: stream.getVideoTracks().map(t => ({ label: t.label, settings: t.getSettings() })) });

			// Wait for Svelte to render the video/canvas elements
			await new Promise(r => setTimeout(r, 300));

			if (!scanVideoEl) throw new Error('Video element not available');

			scanVideoEl.srcObject = stream;
			scanVideoEl.setAttribute('autoplay', '');
			scanVideoEl.setAttribute('playsinline', '');
			scanVideoEl.setAttribute('muted', '');

			// Wait for video to actually have data (more reliable than readyState polling on Safari)
			await new Promise<void>((resolve, reject) => {
				const video = scanVideoEl!;
				dlog('qr-scan', 'Video readyState before wait', video.readyState);
				if (video.readyState >= 2) { resolve(); return; }
				const onLoaded = () => { video.removeEventListener('loadeddata', onLoaded); resolve(); };
				video.addEventListener('loadeddata', onLoaded);
				// Timeout fallback
				setTimeout(() => { video.removeEventListener('loadeddata', onLoaded); resolve(); }, 3000);
			});

			await scanVideoEl.play();
			dlog('qr-scan', 'Video playing', { readyState: scanVideoEl.readyState, videoWidth: scanVideoEl.videoWidth, videoHeight: scanVideoEl.videoHeight });

			const canvas = scanCanvasEl;
			if (!canvas) throw new Error('Canvas element not available');
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) throw new Error('Cannot get canvas context');

			let frameCount = 0;
			async function scanFrame() {
				if (!scanning || !scanVideoEl) return;
				frameCount++;
				const logThisFrame = frameCount <= 3 || frameCount % 10 === 0;

				try {
					// Prefer native BarcodeDetector (Safari iOS 17.2+, Chrome 83+)
					if (nativeBarcodeDetector) {
						if (logThisFrame) dlog('qr-scan', `Native detect frame #${frameCount}`, { vw: scanVideoEl.videoWidth, vh: scanVideoEl.videoHeight, readyState: scanVideoEl.readyState });
						const barcodes = await nativeBarcodeDetector.detect(scanVideoEl);
						if (logThisFrame) dlog('qr-scan', `Native result`, { count: barcodes.length, first: barcodes[0]?.rawValue?.slice(0, 80) });
						if (barcodes.length > 0 && barcodes[0].rawValue) {
							dlog('qr-scan', 'QR FOUND (native)', barcodes[0].rawValue.slice(0, 200));
							stopQRScan();
							importInput = barcodes[0].rawValue;
							handleImport();
							return;
						}
					} else {
						// Fallback: jsQR via canvas
						const vw = scanVideoEl.videoWidth;
						const vh = scanVideoEl.videoHeight;

						if (vw && vh) {
							const scale = Math.min(1, SCAN_MAX_DIM / Math.max(vw, vh));
							const sw = Math.round(vw * scale);
							const sh = Math.round(vh * scale);
							canvas!.width = sw;
							canvas!.height = sh;

							// Draw video element directly — createImageBitmap can return
							// orientation-rotated frames on iOS Safari, breaking QR detection
							ctx!.drawImage(scanVideoEl!, 0, 0, sw, sh);

							const imageData = ctx!.getImageData(0, 0, sw, sh);

							let hasData = false;
							for (let i = 0; i < Math.min(imageData.data.length, 1000); i += 4) {
								if (imageData.data[i] || imageData.data[i+1] || imageData.data[i+2]) {
									hasData = true;
									break;
								}
							}
							if (logThisFrame) {
								const cx = Math.floor(sw / 2), cy = Math.floor(sh / 2);
								const idx = (cy * sw + cx) * 4;
								const centerPixel = `[${imageData.data[idx]},${imageData.data[idx+1]},${imageData.data[idx+2]},${imageData.data[idx+3]}]`;
								dlog('qr-scan', `jsQR frame #${frameCount}`, { sw, sh, hasData, centerPixel });
							}

							if (hasData) {
								const result = jsQR(imageData.data, sw, sh, { inversionAttempts: 'attemptBoth' });
								if (result?.data) {
									dlog('qr-scan', 'QR FOUND (jsQR)', result.data.slice(0, 200));
									stopQRScan();
									importInput = result.data;
									handleImport();
									return;
								}
							}
						} else if (logThisFrame) {
							dlog('qr-scan', `No video dimensions frame #${frameCount}`, { vw, vh });
						}
					}
				} catch (e) {
					if (logThisFrame) dlog('qr-scan', `Frame error #${frameCount}`, String(e));
				}

				scanTimer = setTimeout(scanFrame, 200);
			}
			dlog('qr-scan', 'Starting scan loop', { native: !!nativeBarcodeDetector });
			scanTimer = setTimeout(scanFrame, 500);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SnapshotShare] Camera access failed:', msg);
			scanError = msg.includes('Permission') || msg.includes('NotAllowed')
				? $_('sharing.cameraErrorPermission')
				: msg.includes('NotFound') || msg.includes('DevicesNotFound')
				? $_('sharing.cameraErrorNotFound')
				: $_('sharing.cameraErrorGeneric', { values: { message: msg } });
			scanning = false;
			if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
		}
	}

	function stopQRScan() {
		scanning = false;
		if (scanTimer !== null) { clearTimeout(scanTimer); scanTimer = null; }
		if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
		if (scanVideoEl) { scanVideoEl.srcObject = null; }
	}

	// --- Clipboard helper ---

	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = $_('sharing.copyFeedbackSuccess', { values: { label } });
			setTimeout(() => copyFeedback = '', 2000);
		} catch {
			copyFeedback = $_('sharing.copyFeedbackFailed');
			setTimeout(() => copyFeedback = '', 2000);
		}
	}

	/** Format a session start timestamp for display */
	function formatSessionDate(iso: string | null): string {
		if (!iso) return 'Unknown';
		try {
			const d = new Date(iso);
			return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
				+ ' at '
				+ d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		} catch {
			return 'Unknown';
		}
	}
</script>

<div class="snapshot-share">

	<!-- ==================== SEND SECTION ==================== -->
	{#if showSend && hasContractions}
		<div class="snapshot-section">
			{#if mode === 'both'}
				<div class="section-header">
					<h3 class="section-title">{$_('sharing.snapshot.sendTitle')}</h3>
					<span class="section-info" title={$_('sharing.snapshot.sendTooltip')}>
						<Info size={14} />
					</span>
				</div>
			{/if}
			<p class="section-desc">{$_('sharing.snapshot.sendDesc')}</p>

			<!-- What to include (sharing preferences) -->
			<button class="share-options-toggle" onclick={() => showShareOptions = !showShareOptions}>
				<Settings2 size={14} />
				<span>{$_('sharing.snapshot.whatToInclude')}</span>
				{#if showShareOptions}
					<ChevronUp size={14} />
				{:else}
					<ChevronDown size={14} />
				{/if}
			</button>

			{#if showShareOptions}
				<div class="share-options">
					<p class="share-options-hint">{$_('sharing.snapshot.alwaysIncludedHint')}</p>
					{#each Object.entries(SHARING_CATEGORY_LABELS) as [cat, meta]}
						<div class="share-option-row">
							<div class="share-option-info">
								<span class="share-option-label">{$_(`sharing.categories.${cat}Label`)}</span>
								<span class="share-option-desc">{$_(`sharing.categories.${cat}Desc`)}</span>
							</div>
							<label class="toggle">
								<input type="checkbox" bind:checked={sharePrefs[cat as SharingCategory]} />
								<span class="toggle-slider"></span>
							</label>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Primary action: native share (mobile) or copy link (desktop) -->
			{#if canNativeShare}
				<button class="share-primary-btn" onclick={handleNativeShare}>
					<Share2 size={20} />
					<span>{$_('sharing.snapshot.shareSessionButton')}</span>
				</button>
			{/if}

			<div class="share-methods-list">
				<!-- Copy link -->
				<button
					class="share-method-row"
					onclick={handleCopyLink}
					disabled={shareState === 'compressing' && activeShareMethod === 'link'}
				>
					<span class="share-method-icon">
						{#if shareState === 'compressing' && activeShareMethod === 'link'}
							<Loader2 size={18} class="spin-icon" />
						{:else}
							<Link size={18} />
						{/if}
					</span>
					<span class="share-method-text">
						<span class="share-method-label">{$_('sharing.snapshot.copyLinkLabel')}</span>
						<span class="share-method-desc">{$_('sharing.snapshot.copyLinkDesc')}</span>
					</span>
					<ChevronRight size={14} class="share-method-arrow" />
				</button>

				<!-- Copy raw data -->
				<button
					class="share-method-row"
					onclick={handleCopyData}
					disabled={shareState === 'compressing' && activeShareMethod === 'data'}
				>
					<span class="share-method-icon">
						{#if shareState === 'compressing' && activeShareMethod === 'data'}
							<Loader2 size={18} class="spin-icon" />
						{:else}
							<Copy size={18} />
						{/if}
					</span>
					<span class="share-method-text">
						<span class="share-method-label">{$_('sharing.snapshot.copyDataLabel')}</span>
						<span class="share-method-desc">{$_('sharing.snapshot.copyDataDesc')}</span>
					</span>
					<ChevronRight size={14} class="share-method-arrow" />
				</button>

				<!-- QR code -->
				{#if compressedCode && !qrAvailable}
					<button class="share-method-row share-method-disabled" disabled title={$_('sharing.snapshot.qrCodeTooLargeTitle')}>
						<span class="share-method-icon"><QrCode size={18} /></span>
						<span class="share-method-text">
							<span class="share-method-label">{$_('sharing.snapshot.qrCodeLabel')}</span>
							<span class="share-method-desc">{$_('sharing.snapshot.qrCodeTooLarge')}</span>
						</span>
					</button>
				{:else}
					<button
						class="share-method-row"
						onclick={handleQrCode}
						disabled={shareState === 'compressing' && activeShareMethod === 'qr'}
					>
						<span class="share-method-icon">
							{#if shareState === 'compressing' && activeShareMethod === 'qr'}
								<Loader2 size={18} class="spin-icon" />
							{:else}
								<QrCode size={18} />
							{/if}
						</span>
						<span class="share-method-text">
							<span class="share-method-label">{$_('sharing.snapshot.qrCodeLabel')}</span>
							<span class="share-method-desc">{$_('sharing.snapshot.qrCodeDesc')}</span>
						</span>
						<ChevronRight size={14} class="share-method-arrow" />
					</button>
				{/if}

				<!-- Short code -->
				{#if hasRelay}
					<button
						class="share-method-row"
						onclick={handleShortCode}
						disabled={shareState === 'compressing' && activeShareMethod === 'shortcode'}
					>
						<span class="share-method-icon">
							{#if shareState === 'compressing' && activeShareMethod === 'shortcode'}
								<Loader2 size={18} class="spin-icon" />
							{:else}
								<Hash size={18} />
							{/if}
						</span>
						<span class="share-method-text">
							<span class="share-method-label">{$_('sharing.snapshot.shortCodeLabel')}</span>
							<span class="share-method-desc">{$_('sharing.snapshot.shortCodeDesc')}</span>
						</span>
						<ChevronRight size={14} class="share-method-arrow" />
					</button>
				{:else}
					<button class="share-method-row share-method-disabled" disabled title={$_('sharing.snapshot.shortCodeDisabledTitle')}>
						<span class="share-method-icon"><Hash size={18} /></span>
						<span class="share-method-text">
							<span class="share-method-label">{$_('sharing.snapshot.shortCodeLabel')}</span>
							<span class="share-method-desc">{$_('sharing.snapshot.shortCodeDisabledDesc')}</span>
						</span>
					</button>
				{/if}
			</div>

			<!-- Short code result -->
			{#if shortCode}
				<div class="result-card">
					<div class="result-header">
						<span class="result-label">{$_('sharing.snapshot.shortCodeResultLabel')}</span>
						<span class="result-expiry">{$_('sharing.snapshot.shortCodeExpiry')}</span>
					</div>
					<div class="code-row">
						<code class="code-value code-lg">{shortCode}</code>
						<button class="icon-btn" onclick={() => copyToClipboard(shortCode, $_('sharing.snapshot.shortCodeLabel'))} aria-label={$_('sharing.copyFeedbackSuccess', { values: { label: $_('sharing.snapshot.shortCodeLabel') } })}>
							<Copy size={16} />
						</button>
					</div>
				</div>
			{/if}

			{#if shortCodeError}
				<div class="error-banner">{shortCodeError}</div>
			{/if}

			<!-- QR code result -->
			{#if qrDataUrl}
				<div class="qr-result">
					<button class="qr-container" onclick={() => fullscreenQr = qrDataUrl} aria-label={$_('sharing.tapToEnlargeHint')}>
						<img src={qrDataUrl} alt="QR code for snapshot" class="qr-image" />
					</button>
					<p class="qr-hint">{$_('sharing.snapshot.qrTapHint')}</p>
				</div>
			{/if}

			{#if qrError}
				<div class="error-banner">{qrError}</div>
			{/if}

			<!-- Copy feedback toast -->
			{#if copyFeedback}
				<div class="copy-toast">{copyFeedback}</div>
			{/if}
		</div>
	{:else if showSend}
		<div class="empty-state-card">
			<QrCode size={28} />
			<p class="empty-state-title">{$_('sharing.snapshot.emptyTitle')}</p>
			<p class="empty-state-desc">{$_('sharing.snapshot.emptyDesc')}</p>
		</div>
	{/if}

	<!-- ==================== DIVIDER ==================== -->
	{#if showSend && showReceive && hasContractions}
		<div class="snapshot-divider"></div>
	{/if}

	<!-- ==================== RECEIVE SECTION ==================== -->
	{#if showReceive}
	<div class="snapshot-section">
		{#if mode === 'both'}
			<h3 class="section-title">{$_('sharing.snapshot.receiveTitle')}</h3>
		{/if}

		{#if mode === 'receive'}
			<p class="receive-intro">{$_('sharing.snapshot.receiveIntro')}</p>
		{/if}

		{#if importState === 'idle' || importState === 'error'}
			{#if !scanning}
				<button class="btn-scan-qr" onclick={startQRScan}>
					<Camera size={18} />
					{$_('sharing.scanQrCodeButton')}
				</button>
			{/if}

			{#if scanError}
				<div class="scan-error">{scanError}</div>
			{/if}

			{#if scanning}
				<div class="scan-fullscreen">
					<video bind:this={scanVideoEl} class="scan-video-full" playsinline muted></video>
					<canvas bind:this={scanCanvasEl} class="scan-canvas"></canvas>
					<div class="scan-overlay">
						<div class="scan-frame"></div>
						<p class="scan-hint">{$_('sharing.scannerHint')}</p>
					</div>
					<button class="scan-close-btn" onclick={stopQRScan} aria-label={$_('common.close')}>
						&times;
					</button>
				</div>
			{/if}

			<div class="receive-methods">
				<div class="receive-method">
					<Camera size={14} />
					<span>{$_('sharing.snapshot.receiveMethodQr')}</span>
				</div>
				<div class="receive-method">
					<Link size={14} />
					<span>{$_('sharing.snapshot.receiveMethodLink')}</span>
				</div>
				<div class="receive-method">
					<Hash size={14} />
					<span>{$_('sharing.snapshot.receiveMethodShortCode')}</span>
				</div>
			</div>

			<div class="import-form">
				<div class="import-textarea-wrap">
					<textarea
						class="import-textarea"
						placeholder={$_('sharing.snapshot.importPlaceholder')}
						rows={3}
						bind:value={importInput}
						onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleImport(); } }}
					></textarea>
					<button class="paste-btn" onclick={handlePasteFromClipboard} aria-label={$_('sharing.snapshot.pasteFromClipboardAriaLabel')} title={$_('sharing.snapshot.pasteFromClipboardAriaLabel')}>
						<ClipboardPaste size={16} />
					</button>
				</div>
				<button
					class="btn-primary import-btn"
					onclick={handleImport}
					disabled={!importInput.trim()}
				>
					<Download size={16} />
					{$_('common.import')}
				</button>
			</div>

			{#if importState === 'error' && importError}
				<div class="error-banner">{importError}</div>
			{/if}

		{:else if importState === 'loading'}
			<div class="import-loading">
				<div class="connecting-spinner"></div>
				<p class="loading-text">{$_('sharing.snapshot.loadingText')}</p>
			</div>

		{:else if importState === 'preview' && importPreview}
			<div class="preview-card">
				<div class="preview-header">{$_('sharing.snapshot.previewHeader')}</div>
				<div class="preview-details">
					<div class="preview-row">
						<span class="preview-label">{$_('sharing.snapshot.previewContractionsLabel')}</span>
						<span class="preview-value">{$_('sharing.snapshot.previewContractionsValue', { values: { contractionCount: importPreview.contractionCount, completedCount: importPreview.completedCount } })}</span>
					</div>
					{#if importPreview.eventCount > 0}
						<div class="preview-row">
							<span class="preview-label">{$_('sharing.snapshot.previewEventsLabel')}</span>
							<span class="preview-value">{importPreview.eventCount}</span>
						</div>
					{/if}
					{#if importPreview.timeRange}
						<div class="preview-row">
							<span class="preview-label">{$_('sharing.snapshot.previewTimeRangeLabel')}</span>
							<span class="preview-value">{importPreview.timeRange}</span>
						</div>
					{/if}
					{#if importPreview.sessionStarted}
						<div class="preview-row">
							<span class="preview-label">{$_('sharing.snapshot.previewSessionStartedLabel')}</span>
							<span class="preview-value">{formatSessionDate(importPreview.sessionStarted)}</span>
						</div>
					{/if}

					{#if importSharedSettings && importPreview.includedCategories.length > 0}
						<div class="preview-divider"></div>
						<div class="preview-section-header">{$_('sharing.snapshot.previewIncludedSettingsHeader')}</div>
						{#each importPreview.includedCategories as cat}
							<label class="preview-category-row">
								<input type="checkbox" bind:checked={importCategories[cat]} />
								<span class="preview-category-label">{$_(`sharing.categories.${cat}Label`)}</span>
							</label>
						{/each}
					{/if}
				</div>
				<div class="preview-actions">
					{#if hasContractions}
						<button class="btn-primary preview-confirm" onclick={() => handleConfirmImport(true)}>
							<Archive size={16} />
							{$_('sharing.snapshot.previewArchiveAndImportButton')}
						</button>
						<button class="btn-secondary preview-replace" onclick={() => handleConfirmImport(false)}>
							{$_('sharing.snapshot.previewReplaceButton')}
						</button>
						<p class="preview-hint">{$_('sharing.snapshot.previewCurrentSessionHint', { values: { count: $session.contractions.length } })}</p>
					{:else}
						<button class="btn-primary preview-confirm" onclick={() => handleConfirmImport(false)}>
							{$_('sharing.snapshot.previewImportCountButton', { values: { count: importPreview.contractionCount } })}
						</button>
					{/if}
					<button class="btn-text" onclick={handleCancelImport}>
						{$_('common.cancel')}
					</button>
				</div>
			</div>
		{/if}
	</div>
	{/if}

	{#if fullscreenQr}
		<button class="qr-fullscreen" onclick={() => fullscreenQr = ''} aria-label={$_('sharing.qrFullscreenCloseHint')}>
			<div class="qr-fullscreen-card">
				<img src={fullscreenQr} alt="QR code (enlarged)" class="qr-fullscreen-img" />
			</div>
			<p class="qr-fullscreen-hint">{$_('sharing.qrFullscreenCloseHint')}</p>
		</button>
	{/if}
</div>

<style>
	.snapshot-share {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* --- Sections --- */

	.snapshot-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.section-title {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.section-info {
		display: flex;
		align-items: center;
		color: var(--text-faint);
		cursor: help;
	}

	.section-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
		margin: 0;
		margin-top: calc(-1 * var(--space-2));
		line-height: 1.4;
	}

	.snapshot-divider {
		height: 1px;
		background: var(--border);
		margin: var(--space-1) 0;
	}

	/* --- Empty state (send, no contractions) --- */

	.empty-state-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--text-faint);
	}

	.empty-state-card :global(svg) {
		opacity: 0.4;
	}

	.empty-state-title {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-muted);
		margin: 0;
	}

	.empty-state-desc {
		font-size: var(--text-sm);
		color: var(--text-faint);
		line-height: 1.5;
		margin: 0;
		max-width: 280px;
	}

	/* --- Receive intro & methods --- */

	.receive-intro {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.receive-methods {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.receive-method {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.receive-method :global(svg) {
		flex-shrink: 0;
		color: var(--text-faint);
	}

	/* --- Share primary button (native share) --- */

	.share-primary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: white;
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		min-height: 48px;
	}

	.share-primary-btn:active {
		filter: brightness(0.9);
	}

	/* --- Share methods list --- */

	.share-methods-list {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.share-method-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border: none;
		border-bottom: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-secondary);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		text-align: left;
		transition: background 150ms;
	}

	.share-method-row:last-child {
		border-bottom: none;
	}

	.share-method-row:active:not(:disabled) {
		background: var(--accent-muted);
	}

	.share-method-row:disabled {
		cursor: not-allowed;
	}

	.share-method-row.share-method-disabled {
		opacity: 0.5;
		color: var(--text-faint);
	}

	.share-method-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		flex-shrink: 0;
	}

	.share-method-icon :global(.spin-icon) {
		animation: spin 0.8s linear infinite;
	}

	.share-method-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.share-method-label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
	}

	.share-method-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
	}

	.share-method-row :global(.share-method-arrow) {
		flex-shrink: 0;
		color: var(--text-faint);
	}

	/* --- Short code result card --- */

	.result-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--accent-muted);
		border-radius: var(--radius-md);
		animation: fadeIn 200ms ease-out;
	}

	.result-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.result-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.result-expiry {
		font-size: var(--text-xs);
		color: var(--text-faint);
		font-style: italic;
	}

	/* --- Code display (shared with SharingPanel pattern) --- */

	.code-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.code-value {
		flex: 1;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
		font-family: monospace;
		letter-spacing: 0.01em;
		word-break: break-all;
	}

	.code-lg {
		font-size: var(--text-lg);
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-height-sm);
		height: var(--btn-height-sm);
		border: none;
		background: none;
		cursor: pointer;
		color: var(--text-muted);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
		-webkit-tap-highlight-color: transparent;
	}

	.icon-btn:active {
		background: var(--bg-card-hover);
	}

	/* --- QR result --- */

	.qr-result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		animation: fadeIn 200ms ease-out;
	}

	.qr-container {
		display: flex;
		justify-content: center;
		padding: var(--space-3);
		background: white;
		border-radius: var(--radius-lg);
		border: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: transform 150ms;
	}

	.qr-container:active {
		transform: scale(0.97);
	}

	.qr-image {
		width: 200px;
		height: 200px;
		image-rendering: pixelated;
	}

	.qr-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		margin: 0;
	}

	/* --- Fullscreen QR viewer --- */

	.qr-fullscreen {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		border: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		animation: fadeIn 200ms ease-out;
	}

	.qr-fullscreen-card {
		background: white;
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		max-width: min(85vw, 85vh);
	}

	.qr-fullscreen-img {
		width: min(75vw, 75vh);
		height: min(75vw, 75vh);
		image-rendering: pixelated;
		display: block;
	}

	.qr-fullscreen-hint {
		color: rgba(255, 255, 255, 0.6);
		font-size: var(--text-sm);
		margin: 0;
	}

	/* --- Copy feedback --- */

	.copy-toast {
		text-align: center;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent);
		animation: fadeIn 200ms ease-out;
	}

	/* --- QR Scanner --- */

	.btn-scan-qr {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		width: 100%;
	}

	.btn-scan-qr:active {
		background: var(--bg-card-hover);
		color: var(--text-secondary);
	}

	.scan-fullscreen {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: black;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.scan-video-full {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.scan-canvas {
		display: none;
	}

	.scan-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		pointer-events: none;
	}

	.scan-frame {
		width: 220px;
		height: 220px;
		border: 3px solid rgba(255, 255, 255, 0.7);
		border-radius: var(--radius-lg);
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
	}

	.scan-hint {
		color: rgba(255, 255, 255, 0.9);
		font-size: var(--text-sm);
		font-weight: 600;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
		margin: 0;
	}

	.scan-close-btn {
		position: absolute;
		top: calc(env(safe-area-inset-top, 0px) + var(--space-3));
		right: var(--space-3);
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		color: white;
		font-size: 28px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		z-index: 1;
	}

	.scan-close-btn:active {
		background: rgba(0, 0, 0, 0.7);
	}

	.scan-error {
		padding: var(--space-2) var(--space-3);
		background: var(--danger-muted);
		color: var(--danger);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	/* --- Import form --- */

	.import-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.import-textarea-wrap {
		position: relative;
	}

	.import-textarea {
		width: 100%;
		padding: var(--space-3);
		padding-right: calc(var(--space-3) + 36px);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		color: var(--text-primary);
		font-size: var(--text-sm);
		font-family: monospace;
		outline: none;
		box-sizing: border-box;
		resize: vertical;
		min-height: 80px;
		line-height: 1.5;
	}

	.import-textarea:focus {
		border-color: var(--accent);
	}

	.import-textarea::placeholder {
		color: var(--text-faint);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: var(--text-sm);
	}

	.paste-btn {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-muted);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.paste-btn:active {
		background: var(--accent-muted);
		color: var(--accent);
		border-color: var(--accent);
	}

	.import-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		white-space: nowrap;
	}

	/* --- Buttons (consistent with SharingPanel) --- */

	.btn-primary {
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: white;
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary:active:not(:disabled) {
		filter: brightness(0.9);
	}

	.btn-text {
		padding: var(--space-2);
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		text-align: center;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-text:active {
		color: var(--text-secondary);
	}

	/* --- Import loading --- */

	.import-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-5) 0;
	}

	.connecting-spinner {
		width: var(--space-6);
		height: var(--space-6);
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.loading-text {
		font-size: var(--text-base);
		color: var(--text-muted);
		margin: 0;
	}

	/* --- Preview card --- */

	.preview-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		animation: slideDown 200ms ease-out;
	}

	.preview-header {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--text-primary);
	}

	.preview-details {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.preview-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}

	.preview-label {
		font-size: var(--text-sm);
		color: var(--text-muted);
		font-weight: 500;
	}

	.preview-value {
		font-size: var(--text-sm);
		color: var(--text-primary);
		font-weight: 600;
		text-align: right;
	}

	.preview-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.preview-confirm {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
	}

	.preview-replace {
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
	}

	.preview-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		text-align: center;
		margin: 0;
		line-height: 1.4;
	}

	/* --- Error --- */

	.error-banner {
		padding: var(--space-2) var(--space-3);
		background: var(--danger-muted);
		color: var(--danger);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	/* --- Sharing preferences (sender) --- */

	.share-options-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.share-options-toggle:active {
		color: var(--text-secondary);
	}

	.share-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.share-options-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		margin: 0 0 var(--space-2) 0;
		line-height: 1.4;
	}

	.share-option-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) 0;
	}

	.share-option-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.share-option-label {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
	}

	.share-option-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
	}

	/* Toggle (reused from SettingsPage) */
	.toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 22px;
		flex-shrink: 0;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--toggle-bg, var(--border));
		border-radius: 999px;
		transition: background 200ms;
	}

	.toggle-slider::before {
		content: '';
		position: absolute;
		height: 16px;
		width: 16px;
		left: 3px;
		bottom: 3px;
		background: var(--toggle-knob, white);
		border-radius: 50%;
		transition: transform 200ms;
	}

	.toggle input:checked + .toggle-slider {
		background: var(--accent);
	}

	.toggle input:checked + .toggle-slider::before {
		transform: translateX(18px);
	}

	/* --- Receiver category checkboxes --- */

	.preview-divider {
		height: 1px;
		background: var(--border);
		margin: var(--space-2) 0;
	}

	.preview-section-header {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--text-secondary);
	}

	.preview-category-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) 0;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.preview-category-row input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
		flex-shrink: 0;
	}

	.preview-category-label {
		font-size: var(--text-sm);
		color: var(--text-primary);
	}

	/* --- Animations --- */

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
