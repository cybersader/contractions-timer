<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getStoredSignalingUrl } from '../../lib/p2p/quick-connect';
	import {
		compressSession, decompressSession,
		generateSnapshotUrl, extractSnapshotCode,
		postSnapshotToRelay, getSnapshotFromRelay,
		isQRCompatible, previewSnapshot,
		type SnapshotPreview,
	} from '../../lib/p2p/snapshot-share';
	import { QRCodeToDataURL } from '../../lib/p2p/qr';
	import type { SessionData } from '../../lib/labor-logic/types';
	import { Copy, Link, Hash, QrCode, Download, Loader2, Camera, Info } from 'lucide-svelte';

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
			const code = await compressSession($session);
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

	async function handleQrCode() {
		activeShareMethod = 'qr';
		qrDataUrl = '';
		try {
			const code = await ensureCompressed();
			if (!isQRCompatible(code)) return;
			const url = generateSnapshotUrl(code);
			qrDataUrl = await QRCodeToDataURL(url);
		} catch (e) {
			console.error('[SnapshotShare] handleQrCode failed:', e);
		} finally {
			activeShareMethod = null;
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

		try {
			const parsed = extractSnapshotCode(raw);
			if (!parsed) {
				throw new Error('Could not recognize this as a snapshot link, code, or data');
			}

			let dataCode: string;

			if (parsed.type === 'shortcode') {
				if (!hasRelay) {
					throw new Error('Short codes require a relay server. Set one up in server options.');
				}
				dataCode = await getSnapshotFromRelay(parsed.code, relayUrl);
			} else {
				dataCode = parsed.code;
			}

			const decompressed = await decompressSession(dataCode);
			importSession = decompressed;
			importPreview = previewSnapshot(decompressed);
			importState = 'preview';
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SnapshotShare] handleImport failed:', msg);
			importError = msg;
			importState = 'error';
		}
	}

	function handleConfirmImport() {
		if (!importSession || !onImport) return;
		onImport(importSession);
		// Reset state
		importInput = '';
		importState = 'idle';
		importPreview = null;
		importSession = null;
	}

	function handleCancelImport() {
		importState = 'idle';
		importPreview = null;
		importSession = null;
		importError = '';
	}

	// --- QR Scanner (receive) ---
	let scanning = $state(false);
	let scanVideoEl: HTMLVideoElement | undefined = $state();
	let hasBarcodeDetector = $state(typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis);
	let scanStream: MediaStream | null = null;
	let scanInterval: ReturnType<typeof setInterval> | null = null;

	async function startQRScan() {
		if (!hasBarcodeDetector) return;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
			scanStream = stream;
			scanning = true;
			await new Promise(r => setTimeout(r, 100));
			if (scanVideoEl) {
				scanVideoEl.srcObject = stream;
				await scanVideoEl.play();
			}
			const detector = new (globalThis as any).BarcodeDetector({ formats: ['qr_code'] });
			scanInterval = setInterval(async () => {
				if (!scanVideoEl || scanVideoEl.readyState < 2) return;
				try {
					const barcodes = await detector.detect(scanVideoEl);
					if (barcodes.length > 0) {
						const raw = barcodes[0].rawValue;
						stopQRScan();
						importInput = raw;
						handleImport();
					}
				} catch {}
			}, 300);
		} catch (e) {
			console.error('[SnapshotShare] Camera access failed:', e);
			scanning = false;
		}
	}

	function stopQRScan() {
		scanning = false;
		if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
		if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
		if (scanVideoEl) { scanVideoEl.srcObject = null; }
	}

	// --- Clipboard helper ---

	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = `${label} copied!`;
			setTimeout(() => copyFeedback = '', 2000);
		} catch {
			copyFeedback = 'Failed to copy';
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
					<h3 class="section-title">Send a snapshot</h3>
					<span class="section-info" title="Sends a frozen copy of your session data. The recipient gets a one-time snapshot, not a live connection.">
						<Info size={14} />
					</span>
				</div>
			{/if}
			<p class="section-desc">Share a one-time copy of your session. Your partner gets a frozen snapshot — not a live connection.</p>

			<div class="share-grid">
				<!-- Copy link -->
				<button
					class="share-method-btn"
					onclick={handleCopyLink}
					disabled={shareState === 'compressing' && activeShareMethod === 'link'}
				>
					{#if shareState === 'compressing' && activeShareMethod === 'link'}
						<Loader2 size={20} class="spin-icon" />
					{:else}
						<Link size={20} />
					{/if}
					<span class="share-method-label">Copy link</span>
				</button>

				<!-- Copy data -->
				<button
					class="share-method-btn"
					onclick={handleCopyData}
					disabled={shareState === 'compressing' && activeShareMethod === 'data'}
				>
					{#if shareState === 'compressing' && activeShareMethod === 'data'}
						<Loader2 size={20} class="spin-icon" />
					{:else}
						<Copy size={20} />
					{/if}
					<span class="share-method-label">Copy data</span>
				</button>

				<!-- Short code -->
				{#if hasRelay}
					<button
						class="share-method-btn"
						onclick={handleShortCode}
						disabled={shareState === 'compressing' && activeShareMethod === 'shortcode'}
					>
						{#if shareState === 'compressing' && activeShareMethod === 'shortcode'}
							<Loader2 size={20} class="spin-icon" />
						{:else}
							<Hash size={20} />
						{/if}
						<span class="share-method-label">Short code</span>
					</button>
				{:else}
					<button class="share-method-btn share-method-disabled" disabled title="Set up a relay in server options to enable short codes">
						<Hash size={20} />
						<span class="share-method-label">Short code</span>
						<span class="share-method-hint">Requires relay</span>
					</button>
				{/if}

				<!-- QR code -->
				{#if compressedCode && !qrAvailable}
					<button class="share-method-btn share-method-disabled" disabled title="Session data is too large for a QR code">
						<QrCode size={20} />
						<span class="share-method-label">QR code</span>
						<span class="share-method-hint">Too large</span>
					</button>
				{:else}
					<button
						class="share-method-btn"
						onclick={handleQrCode}
						disabled={shareState === 'compressing' && activeShareMethod === 'qr'}
					>
						{#if shareState === 'compressing' && activeShareMethod === 'qr'}
							<Loader2 size={20} class="spin-icon" />
						{:else}
							<QrCode size={20} />
						{/if}
						<span class="share-method-label">QR code</span>
					</button>
				{/if}
			</div>

			<!-- Short code result -->
			{#if shortCode}
				<div class="result-card">
					<div class="result-header">
						<span class="result-label">Short code</span>
						<span class="result-expiry">Expires in 5 min</span>
					</div>
					<div class="code-row">
						<code class="code-value code-lg">{shortCode}</code>
						<button class="icon-btn" onclick={() => copyToClipboard(shortCode, 'Short code')} aria-label="Copy short code">
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
					<div class="qr-container">
						<img src={qrDataUrl} alt="QR code for snapshot" class="qr-image" />
					</div>
					<p class="qr-hint">Scan to import this snapshot</p>
				</div>
			{/if}

			<!-- Copy feedback toast -->
			{#if copyFeedback}
				<div class="copy-toast">{copyFeedback}</div>
			{/if}
		</div>
	{:else if showSend}
		<div class="empty-state-card">
			<QrCode size={28} />
			<p class="empty-state-title">No session data yet</p>
			<p class="empty-state-desc">Start tracking contractions, then come back here to share your data with your partner or another device.</p>
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
			<h3 class="section-title">Receive a snapshot</h3>
		{/if}

		{#if mode === 'receive'}
			<p class="receive-intro">Import session data shared by your partner or from another device.</p>
		{/if}

		{#if importState === 'idle' || importState === 'error'}
			{#if hasBarcodeDetector && !scanning}
				<button class="btn-scan-qr" onclick={startQRScan}>
					<Camera size={18} />
					Scan QR code
				</button>
			{/if}

			{#if scanning}
				<div class="scan-preview">
					<video bind:this={scanVideoEl} class="scan-video" playsinline muted></video>
					<button class="btn-text" onclick={stopQRScan}>Stop scanning</button>
				</div>
			{/if}

			<div class="receive-methods">
				<div class="receive-method">
					<Camera size={14} />
					<span>{hasBarcodeDetector ? 'Scan a QR code with your camera' : 'QR scanning available on mobile browsers'}</span>
				</div>
				<div class="receive-method">
					<Link size={14} />
					<span>Paste a share link from your partner</span>
				</div>
				<div class="receive-method">
					<Hash size={14} />
					<span>Enter a short code (if using a relay)</span>
				</div>
			</div>

			<div class="import-form">
				<label class="import-label">
					<input
						type="text"
						class="import-input"
						placeholder="Paste a link, short code, or data..."
						bind:value={importInput}
						onkeydown={(e) => { if (e.key === 'Enter') handleImport(); }}
					/>
				</label>
				<button
					class="btn-primary import-btn"
					onclick={handleImport}
					disabled={!importInput.trim()}
				>
					<Download size={16} />
					Import
				</button>
			</div>

			{#if importState === 'error' && importError}
				<div class="error-banner">{importError}</div>
			{/if}

		{:else if importState === 'loading'}
			<div class="import-loading">
				<div class="connecting-spinner"></div>
				<p class="loading-text">Loading snapshot...</p>
			</div>

		{:else if importState === 'preview' && importPreview}
			<div class="preview-card">
				<div class="preview-header">Import this snapshot?</div>
				<div class="preview-details">
					<div class="preview-row">
						<span class="preview-label">Contractions</span>
						<span class="preview-value">{importPreview.contractionCount} ({importPreview.completedCount} completed)</span>
					</div>
					{#if importPreview.eventCount > 0}
						<div class="preview-row">
							<span class="preview-label">Events</span>
							<span class="preview-value">{importPreview.eventCount}</span>
						</div>
					{/if}
					{#if importPreview.timeRange}
						<div class="preview-row">
							<span class="preview-label">Time range</span>
							<span class="preview-value">{importPreview.timeRange}</span>
						</div>
					{/if}
					{#if importPreview.sessionStarted}
						<div class="preview-row">
							<span class="preview-label">Session started</span>
							<span class="preview-value">{formatSessionDate(importPreview.sessionStarted)}</span>
						</div>
					{/if}
				</div>
				{#if hasContractions}
					<div class="preview-warning">
						This will replace your current session ({$session.contractions.length} contractions).
					</div>
				{/if}
				<div class="preview-actions">
					<button class="btn-primary preview-confirm" onclick={handleConfirmImport}>
						Import {importPreview.contractionCount} contractions
					</button>
					<button class="btn-text" onclick={handleCancelImport}>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	</div>
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

	/* --- Share grid (2x2) --- */

	.share-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.share-method-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-3);
		min-height: var(--btn-height-lg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		color: var(--text-secondary);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: border-color var(--transition-fast), background var(--transition-fast);
		position: relative;
	}

	.share-method-btn:active:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.share-method-btn:disabled {
		cursor: not-allowed;
	}

	.share-method-btn.share-method-disabled {
		opacity: 0.5;
		color: var(--text-faint);
	}

	.share-method-btn :global(.spin-icon) {
		animation: spin 0.8s linear infinite;
	}

	.share-method-label {
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.share-method-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		font-weight: 400;
		position: absolute;
		bottom: var(--space-1);
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

	.scan-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: black;
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.scan-video {
		width: 100%;
		max-height: 200px;
		border-radius: var(--radius-md);
		object-fit: cover;
	}

	/* --- Import form --- */

	.import-form {
		display: flex;
		gap: var(--space-2);
		align-items: stretch;
	}

	.import-label {
		flex: 1;
		display: flex;
	}

	.import-input {
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		color: var(--text-primary);
		font-size: var(--text-base);
		outline: none;
		box-sizing: border-box;
		font-family: monospace;
	}

	.import-input:focus {
		border-color: var(--accent);
	}

	.import-input::placeholder {
		color: var(--text-faint);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: var(--text-sm);
	}

	.import-btn {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
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

	.preview-warning {
		padding: var(--space-2) var(--space-3);
		background: var(--danger-muted);
		color: var(--danger);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 500;
		line-height: 1.4;
	}

	.preview-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.preview-confirm {
		padding: var(--space-3);
	}

	/* --- Error --- */

	.error-banner {
		padding: var(--space-2) var(--space-3);
		background: var(--danger-muted);
		color: var(--danger);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
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
