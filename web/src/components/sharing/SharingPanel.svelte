<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { EMPTY_SESSION, type SessionData } from '../../lib/labor-logic/types';
	import { peerState, isP2PActive, peerCount, type P2PState } from '../../lib/stores/p2p';
	import { testSignalingBackend } from '../../lib/p2p/http-signaling';
	import SnapshotShare from './SnapshotShare.svelte';
	import {
		startSharing, joinSharing, stopSharing,
		startPrivateHost, completePrivateHost, joinPrivateOffer, getPrivateOfferUrl, getPrivateAnswerUrl,
	} from '../../lib/p2p/sync-bridge';
	import { isValidRoomCode, generateDisplayName, generatePassphrase } from '../../lib/p2p/room-codes';
	import { getRoomUrl, SIGNALING_PRESETS, getStoredSignalingUrl, setStoredSignalingUrl } from '../../lib/p2p/quick-connect';
	import {
		STUN_PRESETS, TURN_PRESETS,
		getStoredStunPreset, setStoredStunPreset,
		getStoredTurnPreset, setStoredTurnPreset,
		getStoredCustomStunUrl, setStoredCustomStunUrl,
		getStoredCustomTurnConfig, setStoredCustomTurnConfig,
		type CustomTurnConfig,
	} from '../../lib/p2p/ice-config';
	import { getSignalingType } from '../../lib/p2p/quick-connect';
	import { QRCodeToDataURL } from '../../lib/p2p/qr';
	import { Copy, Share2, Eye, Pencil, Wifi, WifiOff, Users, Lock, Unlock, Shield, ChevronDown, ChevronUp, Settings, Camera, Dices, Loader2, ExternalLink, Download } from 'lucide-svelte';
	import jsQR from 'jsqr';
	import { dlog } from '../../lib/debug-log';

	interface Props {
		/** Pre-filled offer code from URL parameter */
		initialOfferCode?: string | null;
		/** Pre-filled answer code from URL parameter (for QR back-and-forth) */
		initialAnswerCode?: string | null;
		/** Pre-filled room code from ?room= URL parameter (Quick mode) */
		initialRoomCode?: string | null;
		/** Pre-filled password from #key= URL hash (Quick mode) */
		initialPassword?: string | null;
		/** Pre-filled snapshot code from #snapshot= URL hash */
		initialSnapshotCode?: string | null;
	}
	let { initialOfferCode = null, initialAnswerCode = null, initialRoomCode = null, initialPassword = null, initialSnapshotCode = null } = $props<Props>();

	function handleSnapshotImport(importedSession: SessionData) {
		session.set(importedSession);
	}

	// --- View state machine ---
	type ShareView = 'menu' | 'send' | 'receive' | 'live-quick' | 'live-private';
	let view: ShareView = $state(
		initialSnapshotCode ? 'receive' :
		initialOfferCode ? 'live-private' :
		initialRoomCode ? 'live-quick' :
		'menu'
	);

	// --- Quick mode state ---
	let userName = $state(generateDisplayName());
	let mode: 'collaborative' | 'view-only' = $state('collaborative');
	let password = $state(initialPassword ?? '');
	let showPassword = $state(!!initialPassword);
	let joinCode = $state(initialRoomCode ?? '');
	let quickAction: 'none' | 'join' = $state(initialRoomCode ? 'join' : 'none');
	let hasRoomToJoin = $state(!!initialRoomCode);
	let privateAction: 'none' | 'accept' = $state('none');

	// --- Loading states ---
	let isStarting = $state(false);
	let isJoining = $state(false);

	// --- Private mode state ---
	let privateOfferInput = $state(initialOfferCode ?? '');
	let privateAnswerInput = $state('');
	let privateStep: 'idle' | 'hosting-waiting' | 'guest-answering' | 'connected' = $state('idle');
	// Track whether we have an invite to accept (from URL)
	let hasInviteToAccept = $state(!!initialOfferCode);

	// --- Advanced settings ---
	let showAdvanced = $state(false);
	let signalingUrl = $state(getStoredSignalingUrl());
	let stunPreset = $state(getStoredStunPreset());
	let turnPreset = $state(getStoredTurnPreset());
	let signalingType = $derived(getSignalingType());
	let customStunUrl = $state(getStoredCustomStunUrl());
	let customTurn: CustomTurnConfig = $state(getStoredCustomTurnConfig());
	let showSetupGuide = $state(false);

	const CF_DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/cybersader/obsidian-contractions-timer/tree/main/web/cf-signaling';
	const CF_CALLS_URL = 'https://github.com/cybersader/obsidian-contractions-timer/tree/main/web/cf-signaling#what-is-turn-and-do-i-need-it';

	let testingSignaling = $state(false);
	let signalingTestResult = $state<{ reachable: boolean; latencyMs: number } | null>(null);

	const diagnostics = $derived($peerState.diagnostics);

	async function handleTestSignaling() {
		testingSignaling = true;
		signalingTestResult = null;
		try {
			signalingTestResult = await testSignalingBackend(signalingUrl || 'https://ntfy.sh');
		} catch {
			signalingTestResult = { reachable: false, latencyMs: 0 };
		} finally {
			testingSignaling = false;
		}
	}

	// --- Shared state ---
	let fullscreenQr = $state('');
	let qrDataUrl = $state('');
	let answerQrDataUrl = $state('');
	let copyFeedback = $state('');
	let scanning = $state(false);
	let scanError = $state('');
	let scanVideoEl: HTMLVideoElement | undefined = $state();
	let scanCanvasEl: HTMLCanvasElement | undefined = $state();

	const status = $derived($peerState.status);
	const roomCode = $derived($peerState.roomCode);
	const peers = $derived($peerState.peers);
	const error = $derived($peerState.error);
	const isOwner = $derived($peerState.isOwner);
	const currentMode = $derived($peerState.mode);
	const shareMode = $derived($peerState.shareMode);
	const offerCode = $derived($peerState.privateOfferCode);
	const answerCode = $derived($peerState.privateAnswerCode);
	const connectPhase = $derived($peerState.connectPhase);

	/** Human-readable phase label */
	function phaseLabel(phase: string | null): string {
		switch (phase) {
			case 'creating-offer': return 'Creating secure room...';
			case 'posting': return 'Publishing room code...';
			case 'waiting-for-partner': return 'Waiting for partner...';
			case 'polling-for-offer': return 'Looking for room...';
			case 'generating-answer': return 'Connecting to host...';
			case 'posting-answer': return 'Sending response...';
			case 'completing': return 'Completing handshake...';
			case 'connected': return 'Connected!';
			default: return 'Connecting...';
		}
	}

	// Generate QR code when hosting (Quick: room URL, Private: offer URL)
	$effect(() => {
		if (status === 'hosting' && shareMode === 'quick' && roomCode) {
			const url = getRoomUrl(roomCode, password || undefined);
			QRCodeToDataURL(url).then(dataUrl => { qrDataUrl = dataUrl; });
		} else if (shareMode === 'private' && offerCode && privateStep === 'hosting-waiting') {
			// Private mode: QR generated while host waits for answer (status is 'connecting')
			const url = getPrivateOfferUrl(offerCode);
			QRCodeToDataURL(url).then(dataUrl => { qrDataUrl = dataUrl; });
		} else {
			qrDataUrl = '';
		}
	});

	// Generate QR code for the answer code (guest side, private mode) — encodes a URL for phone camera scanning
	$effect(() => {
		if (answerCode && privateStep === 'guest-answering') {
			const url = getPrivateAnswerUrl(answerCode);
			QRCodeToDataURL(url).then(dataUrl => { answerQrDataUrl = dataUrl; });
		} else {
			answerQrDataUrl = '';
		}
	});

	// Auto-join room from URL (?room=CODE#key=PASSWORD) — fires once when name is entered
	let autoRoomJoinAttempted = false;
	$effect(() => {
		if (hasRoomToJoin && joinCode && userName.trim() && !autoRoomJoinAttempted && status === 'disconnected') {
			autoRoomJoinAttempted = true;
			handleJoin();
		}
	});

	// Auto-process initial offer code from URL — fires once when name is entered
	let autoJoinAttempted = false;
	$effect(() => {
		if (initialOfferCode && hasInviteToAccept && userName.trim() && !autoJoinAttempted && privateStep === 'idle') {
			autoJoinAttempted = true;
			handlePrivateJoin();
		}
	});

	// Watch for background connection completion (guest private mode)
	$effect(() => {
		if (shareMode === 'private' && privateStep === 'guest-answering') {
			if (status === 'hosting' || status === 'joined') {
				privateStep = 'connected';
			} else if (status === 'disconnected' && $peerState.error) {
				localError = $peerState.error;
				privateStep = 'idle';
				hasInviteToAccept = false;
			}
		}
	});

	// Listen for answer codes from other tabs (BroadcastChannel) when host is waiting
	$effect(() => {
		if (privateStep !== 'hosting-waiting') return;
		if (typeof BroadcastChannel === 'undefined') return;
		const bc = new BroadcastChannel('ct-private-connect');
		bc.onmessage = (event: MessageEvent) => {
			if (event.data?.type === 'answer-code' && event.data.code) {
				debug('[SharingPanel] Received answer via BroadcastChannel');
				privateAnswerInput = event.data.code;
				handlePrivateComplete();
			}
		};
		return () => bc.close();
	});

	// Auto-complete from initialAnswerCode (opened via ?answer= URL)
	$effect(() => {
		if (initialAnswerCode && privateStep === 'hosting-waiting' && !privateAnswerInput) {
			debug('[SharingPanel] Auto-filling answer from URL param');
			privateAnswerInput = initialAnswerCode;
			handlePrivateComplete();
		}
	});

	function debug(...args: unknown[]) { console.debug('[SharingPanel]', ...args); }

	// --- Quick mode handlers ---

	async function handleStartSharing() {
		if (!userName.trim()) return;
		localError = '';
		isStarting = true;
		setStoredSignalingUrl(signalingUrl);
		setStoredStunPreset(stunPreset);
		setStoredTurnPreset(turnPreset);
		try {
			await startSharing({
				userName: userName.trim(),
				mode,
				password: password || undefined,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SharingPanel] handleStartSharing failed:', msg);
			localError = msg;
		} finally {
			isStarting = false;
		}
	}

	async function handleJoin() {
		const code = joinCode.trim().toLowerCase();
		if (!code || !userName.trim()) return;
		localError = '';
		isJoining = true;
		try {
			await joinSharing({
				roomCode: code,
				guestName: userName.trim(),
				password: password || undefined,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SharingPanel] handleJoin failed:', msg);
			localError = msg;
		} finally {
			isJoining = false;
		}
	}

	function handleGeneratePassphrase() {
		password = generatePassphrase();
		showPassword = true;
	}

	// --- Private mode handlers ---

	async function handlePrivateHost() {
		if (!userName.trim()) return;
		try {
			await startPrivateHost(userName.trim());
			privateStep = 'hosting-waiting';
		} catch (e) {
			console.error('[SharingPanel] handlePrivateHost failed:', e);
		}
	}

	async function handlePrivateComplete() {
		if (!privateAnswerInput.trim()) return;
		localError = '';
		try {
			await completePrivateHost(privateAnswerInput.trim(), userName.trim());
			privateStep = 'connected';
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SharingPanel] handlePrivateComplete failed:', msg);
			localError = msg;
			// Stay on hosting-waiting so user can retry with a new invite
		}
	}

	let localError = $state('');

	/** Wrap a promise with a timeout */
	function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
		return Promise.race([
			promise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
			),
		]);
	}

	async function handlePrivateJoin() {
		if (!privateOfferInput.trim() || !userName.trim()) return;
		localError = '';
		privateStep = 'guest-answering';
		try {
			// 15s timeout — covers ICE gathering (~5s) + SDP processing only.
			// Connection wait runs in background (no timeout — user cancels manually).
			await withTimeout(
				joinPrivateOffer(privateOfferInput.trim(), userName.trim()),
				15000,
				'Generating response code',
			);
			// Answer code is now generated and displayed.
			// Connection will complete in background when host enters the code.
			// Watch peerState for status changes.
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SharingPanel] handlePrivateJoin failed:', msg);
			localError = msg;
			privateStep = 'idle';
			hasInviteToAccept = false; // Show manual form so user can see the error
			stopSharing(); // Clean up any partial state
		}
	}

	// --- QR Scanner (jsQR-based for cross-browser support) ---

	let scanStream: MediaStream | null = null;
	let scanTimer: ReturnType<typeof setTimeout> | null = null;

	/** Max canvas dimension for jsQR — higher = better detection at cost of CPU */
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

	/** Route a scanned QR value to the right field based on scan target */
	function handleScanResult(raw: string, target: 'answer' | 'offer' | 'room') {
		stopQRScan();
		if (target === 'room') {
			try {
				const url = new URL(raw);
				const room = url.searchParams.get('room');
				if (room) {
					joinCode = room;
					const hash = url.hash.slice(1);
					const hashParams = new URLSearchParams(hash);
					const key = hashParams.get('key');
					if (key) password = key;
				} else {
					joinCode = raw;
				}
			} catch {
				joinCode = raw;
			}
		} else if (target === 'answer') {
			if (raw.includes('?answer=')) {
				try {
					const url = new URL(raw);
					privateAnswerInput = url.searchParams.get('answer') || raw;
				} catch { privateAnswerInput = raw; }
			} else {
				privateAnswerInput = raw;
			}
		} else if (target === 'offer') {
			if (raw.includes('?offer=')) {
				try {
					const url = new URL(raw);
					privateOfferInput = url.searchParams.get('offer') || raw;
				} catch { privateOfferInput = raw; }
			} else {
				privateOfferInput = raw;
			}
		}
	}

	async function startQRScan(target: 'answer' | 'offer' | 'room') {
		scanError = '';
		await initBarcodeDetector();
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error(
					window.isSecureContext === false
						? 'Camera requires HTTPS. This page is not in a secure context.'
						: 'Camera API not available in this browser.'
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

			await new Promise(r => setTimeout(r, 300));

			if (!scanVideoEl) throw new Error('Video element not available');

			scanVideoEl.srcObject = stream;
			scanVideoEl.setAttribute('autoplay', '');
			scanVideoEl.setAttribute('playsinline', '');
			scanVideoEl.setAttribute('muted', '');

			// Wait for video to actually have data (more reliable than readyState polling on Safari)
			await new Promise<void>((resolve) => {
				const video = scanVideoEl!;
				dlog('qr-scan', 'Video readyState before wait', video.readyState);
				if (video.readyState >= 2) { resolve(); return; }
				const onLoaded = () => { video.removeEventListener('loadeddata', onLoaded); resolve(); };
				video.addEventListener('loadeddata', onLoaded);
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
							handleScanResult(barcodes[0].rawValue, target);
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

							// Draw video element directly to canvas — createImageBitmap can return
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
									handleScanResult(result.data, target);
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
			dlog('qr-scan', 'Starting scan loop', { target, native: !!nativeBarcodeDetector });
			scanTimer = setTimeout(scanFrame, 500);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[SharingPanel] Camera access failed:', msg);
			scanError = msg.includes('Permission') || msg.includes('NotAllowed')
				? 'Camera permission denied. Check your browser settings.'
				: msg.includes('NotFound') || msg.includes('DevicesNotFound')
				? 'No camera found on this device.'
				: `Camera error: ${msg}`;
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

	// --- Shared handlers ---

	function handleStop() {
		stopSharing();
		stopQRScan();
		privateStep = 'idle';
		privateOfferInput = '';
		privateAnswerInput = '';
		qrDataUrl = '';
		answerQrDataUrl = '';
		quickAction = 'none';
		privateAction = 'none';
	}

	async function handleCopy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = `${label} copied!`;
			setTimeout(() => copyFeedback = '', 2000);
		} catch {
			copyFeedback = 'Failed to copy';
			setTimeout(() => copyFeedback = '', 2000);
		}
	}

	async function handleNativeShare(title: string, text: string, url: string) {
		if (navigator.share) {
			try { await navigator.share({ title, text, url }); } catch {}
		}
	}
</script>

<div class="sharing-panel">
	{#if privateStep === 'hosting-waiting'}
		<!-- ======= Private: Host waiting for guest's answer ======= -->
		<div class="sharing-section">
			<div class="step-label">Step 1: Share this with your partner</div>

			{#if qrDataUrl}
				<button class="qr-container" onclick={() => fullscreenQr = qrDataUrl} aria-label="Tap to enlarge QR code">
					<img src={qrDataUrl} alt="QR code for private invite" class="qr-image" />
				</button>
				<p class="qr-tap-hint">Tap to enlarge</p>
			{/if}

			{#if offerCode}
				<div class="code-box">
					<span class="code-box-label">Invite code</span>
					<div class="code-row">
						<code class="code-value">{offerCode.length > 40 ? offerCode.slice(0, 40) + '...' : offerCode}</code>
						<button class="icon-btn" onclick={() => handleCopy(offerCode!, 'Invite code')} aria-label="Copy invite code">
							<Copy size={16} />
						</button>
					</div>
				</div>

				<div class="share-buttons">
					{#if typeof navigator !== 'undefined' && navigator.share}
						<button class="btn-secondary share-btn" onclick={() => handleNativeShare('Join my contraction timer', 'Open this link to connect:', getPrivateOfferUrl(offerCode!))}>
							<Share2 size={16} />
							Share
						</button>
					{/if}
					<button class="btn-secondary share-btn" onclick={() => handleCopy(getPrivateOfferUrl(offerCode!), 'Link')}>
						<Copy size={16} />
						Copy link
					</button>
				</div>
			{/if}

			<div class="step-label step-2">Step 2: Enter partner's response code</div>

			<label class="sharing-label">
				<input type="text" class="sharing-input mono-input" placeholder="Paste their response code..." bind:value={privateAnswerInput} />
			</label>
			<div class="step2-actions">
				<button class="btn-primary step2-connect" onclick={handlePrivateComplete} disabled={!privateAnswerInput.trim()}>
					Connect
				</button>
				{#if !scanning}
					<button class="btn-secondary scan-btn" onclick={() => startQRScan('answer')} aria-label="Scan QR code">
						<Camera size={18} />
					</button>
				{/if}
			</div>

			<button class="btn-text" onclick={handleStop}>
				Cancel
			</button>
		</div>

	{:else if privateStep === 'guest-answering'}
		<!-- ======= Private: Guest showing answer code ======= -->
		<div class="sharing-section">
			{#if answerCode}
				<div class="step-label">Send this code back to your partner</div>

				{#if answerQrDataUrl}
					<button class="qr-container" onclick={() => fullscreenQr = answerQrDataUrl} aria-label="Tap to enlarge QR code">
						<img src={answerQrDataUrl} alt="QR code for response code" class="qr-image" />
					</button>
					<p class="qr-tap-hint">Tap to enlarge</p>
				{/if}

				<div class="code-box">
					<span class="code-box-label">Response code</span>
					<div class="code-row">
						<code class="code-value">{answerCode.length > 40 ? answerCode.slice(0, 40) + '...' : answerCode}</code>
						<button class="icon-btn" onclick={() => handleCopy(answerCode!, 'Response code')} aria-label="Copy response code">
							<Copy size={16} />
						</button>
					</div>
				</div>

				<div class="share-buttons">
					{#if typeof navigator !== 'undefined' && navigator.share}
						<button class="btn-secondary share-btn" onclick={() => handleNativeShare('Response code', 'Open this link to connect:', getPrivateAnswerUrl(answerCode!))}>
							<Share2 size={16} />
							Share
						</button>
					{/if}
					<button class="btn-secondary share-btn" onclick={() => handleCopy(getPrivateAnswerUrl(answerCode!), 'Response link')}>
						<Copy size={16} />
						Copy link
					</button>
				</div>

				<div class="waiting-hint">
					<div class="connecting-spinner small-spinner"></div>
					Waiting for partner to enter code...
				</div>
			{:else}
				<div class="sharing-status">
					<div class="connecting-spinner"></div>
					<p class="status-text">Generating response code...</p>
				</div>
			{/if}

			<button class="btn-text" onclick={handleStop}>
				Cancel
			</button>
		</div>

	{:else if status === 'disconnected' || (status === 'connecting' && shareMode !== 'private')}
		<!-- ======= View-based navigation ======= -->
		{#if view === 'menu'}
			<div class="action-cards">
				<button class="action-card" onclick={() => view = 'send'}>
					<Share2 size={24} />
					<span class="action-card-title">Send</span>
					<span class="action-card-desc">Share your session data</span>
				</button>
				<button class="action-card" onclick={() => view = 'receive'}>
					<Download size={24} />
					<span class="action-card-title">Receive</span>
					<span class="action-card-desc">Import shared data</span>
				</button>
			</div>

			<button class="live-card" onclick={() => view = 'live-quick'}>
				<Wifi size={20} />
				<div class="live-card-text">
					<span class="live-card-title">Share live</span>
					<span class="live-card-desc">Real-time sync between devices</span>
				</div>
			</button>

		{:else if view === 'send'}
			<button class="back-link" onclick={() => view = 'menu'}>← Back</button>
			<SnapshotShare mode="send" onImport={handleSnapshotImport} />

		{:else if view === 'receive'}
			<button class="back-link" onclick={() => view = 'menu'}>← Back</button>
			<SnapshotShare mode="receive" {initialSnapshotCode} onImport={handleSnapshotImport} />

		{:else if view === 'live-quick'}
			<button class="back-link" onclick={() => view = 'menu'}>← Back</button>
			<div class="mode-desc">
				Uses a relay to find your partner. Works across any network.
			</div>

			<div class="sharing-section">
				<label class="sharing-label">
					Your name
					<input type="text" class="sharing-input" placeholder="Mom, Partner, etc." bind:value={userName} maxlength={30} />
				</label>

				<div class="sharing-label">Joiners can</div>
				<div class="mode-radios">
					<label class="mode-radio" class:mode-selected={mode === 'collaborative'}>
						<input type="radio" bind:group={mode} value="collaborative" />
						<Pencil size={16} />
						<span>View and edit together</span>
					</label>
					<label class="mode-radio" class:mode-selected={mode === 'view-only'}>
						<input type="radio" bind:group={mode} value="view-only" />
						<Eye size={16} />
						<span>View only</span>
					</label>
				</div>

				<label class="sharing-label">
					Password (optional)
					<div class="password-field">
						{#if showPassword}
							<input type="text" class="sharing-input" placeholder="Adds encryption" bind:value={password} />
						{:else}
							<input type="password" class="sharing-input" placeholder="Adds encryption" bind:value={password} />
						{/if}
						<button class="password-action" onclick={handleGeneratePassphrase} aria-label="Generate passphrase" title="Generate passphrase">
							<Dices size={16} />
						</button>
						<button class="password-toggle" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'}>
							{#if password}
								{#if showPassword}<Unlock size={16} />{:else}<Lock size={16} />{/if}
							{/if}
						</button>
					</div>
					<span class="sharing-hint">
						{#if password && showPassword}
							Share this passphrase with your partner
						{:else}
							Encrypts the session end-to-end
						{/if}
					</span>
				</label>

				<!-- Advanced: Server selection -->
				<button class="advanced-toggle" onclick={() => showAdvanced = !showAdvanced}>
					<Settings size={14} />
					<span>Server options</span>
					{#if showAdvanced}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
				</button>

				{#if showAdvanced}
					<div class="advanced-section">
						<label class="sharing-label">
							Signaling backend
							<select class="sharing-select" bind:value={signalingUrl} onchange={() => setStoredSignalingUrl(signalingUrl)}>
								{#each SIGNALING_PRESETS as preset}
									<option value={preset.url}>{preset.label}</option>
								{/each}
							</select>
							<span class="sharing-hint">
								{SIGNALING_PRESETS.find(p => p.url === signalingUrl)?.description ?? 'Routes the initial handshake (encrypted).'}
							</span>
						</label>

						{#if signalingUrl === ''}
							<label class="sharing-label">
								Worker URL
								<input type="url" class="sharing-input mono-input" placeholder="https://ct-signaling.yourname.workers.dev" bind:value={signalingUrl} onblur={() => setStoredSignalingUrl(signalingUrl)} />
							</label>
						{/if}

						<label class="sharing-label">
							STUN server
							<select class="sharing-select" bind:value={stunPreset} onchange={() => setStoredStunPreset(stunPreset)}>
								{#each STUN_PRESETS as preset}
									<option value={preset.label}>{preset.label}</option>
								{/each}
							</select>
							<span class="sharing-hint">
								{STUN_PRESETS.find(p => p.label === stunPreset)?.description ?? ''}
							</span>
						</label>

						{#if stunPreset === 'Custom'}
							<label class="sharing-label">
								Custom STUN URL
								<input type="url" class="sharing-input mono-input" placeholder="stun:stun.example.com:3478" bind:value={customStunUrl} onblur={() => setStoredCustomStunUrl(customStunUrl)} />
							</label>
						{/if}

						<label class="sharing-label">
							TURN relay
							<select class="sharing-select" bind:value={turnPreset} onchange={() => setStoredTurnPreset(turnPreset)}>
								{#each TURN_PRESETS as preset}
									<option value={preset.label}>{preset.label}</option>
								{/each}
							</select>
							<span class="sharing-hint">
								{TURN_PRESETS.find(p => p.label === turnPreset)?.description ?? ''}
							</span>
						</label>

						{#if turnPreset === 'Cloudflare TURN' || turnPreset === 'Custom'}
							<div class="custom-turn-fields">
								<label class="sharing-label">
									TURN URL
									<input type="url" class="sharing-input mono-input" placeholder="turn:turn.example.com:3478" bind:value={customTurn.url} onblur={() => setStoredCustomTurnConfig(customTurn)} />
								</label>
								<label class="sharing-label">
									Username
									<input type="text" class="sharing-input" placeholder="username" bind:value={customTurn.username} onblur={() => setStoredCustomTurnConfig(customTurn)} />
								</label>
								<label class="sharing-label">
									Credential
									<input type="password" class="sharing-input" placeholder="credential" bind:value={customTurn.credential} onblur={() => setStoredCustomTurnConfig(customTurn)} />
								</label>
							</div>
						{/if}

						<div class="privacy-note">
							<span class="sharing-hint">All SDP data is encrypted before leaving your device. STUN only sees your IP. TURN relays encrypted data — cannot read content.</span>
						</div>

						<!-- Test signaling button -->
						<button class="btn-secondary btn-with-icon" onclick={handleTestSignaling} disabled={testingSignaling} style="font-size: var(--text-sm)">
							{#if testingSignaling}
								<Loader2 size={14} class="spin-icon" />
								Testing...
							{:else}
								Test signaling
							{/if}
						</button>
						{#if signalingTestResult}
							<div class="test-result" class:test-ok={signalingTestResult.reachable} class:test-fail={!signalingTestResult.reachable}>
								{#if signalingTestResult.reachable}
									Reachable ({signalingTestResult.latencyMs}ms)
								{:else}
									Unreachable — try a different backend
								{/if}
							</div>
						{/if}

						<!-- Connection reliability guide -->
						<button class="setup-guide-toggle" onclick={() => showSetupGuide = !showSetupGuide}>
							<span>Deploy your own relay (recommended)</span>
							{#if showSetupGuide}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
						</button>

						{#if showSetupGuide}
							<div class="setup-guide">
								<div class="tier-card">
									<div class="tier-header">
										<span class="tier-badge tier-basic">Basic</span>
										<span class="tier-label">No setup needed</span>
									</div>
									<p class="tier-desc">Uses free public servers. Works on the same WiFi network. Cross-network connections may be unreliable.</p>
									<div class="tier-config">ntfy.sh + Google STUN + Open Relay TURN</div>
								</div>

								<div class="tier-card tier-recommended">
									<div class="tier-header">
										<span class="tier-badge tier-cf">Advanced</span>
										<span class="tier-label">Your own private relay</span>
									</div>
									<p class="tier-desc">Works everywhere. Free. Takes 2 minutes. No credit card needed.</p>
									<div class="tier-steps">
										<div class="tier-step">
											<span class="tier-step-num">1</span>
											<div class="tier-step-content">
												<span class="tier-step-title">Deploy your relay</span>
												<span class="tier-step-desc">You'll need a free <a href="https://github.com/signup" target="_blank" rel="noopener">GitHub</a> and <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">Cloudflare</a> account. Cloudflare creates a copy of the relay code and deploys it for you.</span>
												<a href={CF_DEPLOY_URL} target="_blank" rel="noopener" class="tier-deploy-btn">
													<ExternalLink size={14} />
													Deploy to Cloudflare (one click)
												</a>
											</div>
										</div>
										<div class="tier-step">
											<span class="tier-step-num">2</span>
											<div class="tier-step-content">
												<span class="tier-step-title">Copy your Worker URL</span>
												<span class="tier-step-desc">After deploying, Cloudflare shows your URL. It looks like <code>ct-signaling.you.workers.dev</code>. Select "My Cloudflare Worker" in the dropdown above and paste it in.</span>
											</div>
										</div>
										<div class="tier-step">
											<span class="tier-step-num">3</span>
											<div class="tier-step-content">
												<span class="tier-step-title">Share the URL with your partner</span>
												<span class="tier-step-desc">Your partner pastes the same URL into their app. Only one person needs to deploy — both use the same relay.</span>
											</div>
										</div>
									</div>
									<div class="tier-faq">
										<details>
											<summary>Cloudflare TURN (optional, advanced)</summary>
											<p class="tier-step-desc">Only needed for sharing across different networks behind strict firewalls. Most connections work without it. <a href={CF_CALLS_URL} target="_blank" rel="noopener">Learn more about TURN</a></p>
										</details>
									</div>
								</div>

								<div class="tier-card">
									<div class="tier-header">
										<span class="tier-badge tier-self">Self-hosted</span>
										<span class="tier-label">Full control</span>
									</div>
									<p class="tier-desc">Run your own signaling server + TURN relay. Zero third-party dependencies.</p>
									<a href="https://github.com/cybersader/obsidian-contractions-timer/tree/main/web/cf-signaling#self-hosting" target="_blank" rel="noopener" class="tier-link">
										<ExternalLink size={12} />
										Setup instructions
									</a>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Action buttons: Share or Join -->
				<div class="action-buttons">
					<button class="btn-primary btn-with-icon" onclick={handleStartSharing} disabled={!userName.trim() || isStarting}>
						{#if isStarting}
							<Loader2 size={18} class="spin-icon" />
							{phaseLabel(connectPhase)}
						{:else}
							Start sharing
						{/if}
					</button>
					<button
						class="btn-secondary btn-with-icon"
						class:btn-active={quickAction === 'join'}
						onclick={() => quickAction = quickAction === 'join' ? 'none' : 'join'}
						disabled={isStarting}
					>
						Join room
					</button>
				</div>

				<!-- Expandable join form -->
				{#if quickAction === 'join'}
					<div class="expand-section">
						{#if !scanning}
							<button class="btn-scan-qr" onclick={() => startQRScan('room')}>
								<Camera size={18} />
								Scan QR code
							</button>
						{/if}

						<label class="sharing-label">
							Room code
							<input type="text" class="sharing-input" placeholder="blue-tiger-42" bind:value={joinCode} />
						</label>
						<button class="btn-primary btn-with-icon" onclick={handleJoin} disabled={!joinCode.trim() || !userName.trim() || isJoining}>
							{#if isJoining}
								<Loader2 size={18} class="spin-icon" />
								{phaseLabel(connectPhase)}
							{:else}
								Connect
							{/if}
						</button>
					</div>
				{/if}
			</div>


			<button class="btn-text private-connect-link" onclick={() => view = 'live-private'}>
				<Shield size={14} />
				Use private connect instead
			</button>

		{:else if view === 'live-private'}
			<button class="back-link" onclick={() => view = 'live-quick'}>← Back</button>

			<div class="private-explainer">
				<div class="private-explainer-header">
					<Shield size={20} />
					<span class="private-explainer-title">Private connect</span>
				</div>
				<p class="private-explainer-desc">Connect by exchanging invite codes manually — no relay server touches your data.</p>

				<div class="private-explainer-details">
					<div class="private-detail">
						<span class="private-detail-icon">1</span>
						<span>One person creates an invite and shares the code</span>
					</div>
					<div class="private-detail">
						<span class="private-detail-icon">2</span>
						<span>The other person accepts and sends back a response code</span>
					</div>
					<div class="private-detail">
						<span class="private-detail-icon">3</span>
						<span>Once exchanged, you're connected peer-to-peer</span>
					</div>
				</div>

				<div class="private-warning">
					<div class="private-warning-header">
						<WifiOff size={14} />
						<span>Connection limitations</span>
					</div>
					<p class="private-warning-text">Without a TURN relay server, this <strong>only works reliably on the same WiFi network</strong>. Connections across different networks (mobile data, different WiFi, corporate firewalls) will usually fail because NAT/firewall rules block direct peer-to-peer traffic.</p>
					<p class="private-warning-text">For reliable cross-network connections, use <strong>Quick Connect</strong> with a Cloudflare Worker relay instead — it's free, takes 2 minutes to set up, and works everywhere.</p>
				</div>

				<details class="private-turn-hint">
					<summary>Already have a TURN server?</summary>
					<p>If you've configured a TURN relay in Quick Connect's server options, private connect will use it too. With TURN, private connect works across any network — you get full privacy <em>and</em> reliability.</p>
				</details>
			</div>

			{#if hasInviteToAccept}
				<!-- Focused flow: received an invite link, just need a name -->
				<div class="sharing-section">
					<div class="invite-banner">
						<Shield size={20} />
						<span>You've received a private invite!</span>
					</div>

					<label class="sharing-label">
						Enter your name to connect
						<input
							type="text"
							class="sharing-input"
							placeholder="Your name"
							bind:value={userName}
							maxlength={30}
						/>
						{#if !userName.trim()}
							<span class="sharing-hint name-required">Name required to connect</span>
						{/if}
					</label>

					<button class="btn-primary" onclick={handlePrivateJoin} disabled={!userName.trim()}>
						Connect
					</button>

					<button class="btn-text" onclick={() => { hasInviteToAccept = false; privateOfferInput = ''; }}>
						Enter code manually instead
					</button>
				</div>
			{:else}
				<!-- Normal flow: create or accept invite -->
				<div class="sharing-section">
					<label class="sharing-label">
						Your name
						<input type="text" class="sharing-input" placeholder="Mom, Partner, etc." bind:value={userName} maxlength={30} />
					</label>

					<!-- Action buttons: Create or Accept -->
					<div class="action-buttons">
						<button class="btn-primary" onclick={handlePrivateHost} disabled={!userName.trim()}>
							Create invite
						</button>
						<button
							class="btn-secondary"
							class:btn-active={privateAction === 'accept'}
							onclick={() => privateAction = privateAction === 'accept' ? 'none' : 'accept'}
						>
							Accept invite
						</button>
					</div>

					<!-- Expandable accept form -->
					{#if privateAction === 'accept'}
						<div class="expand-section">
							{#if !scanning}
								<button class="btn-scan-qr" onclick={() => startQRScan('offer')}>
									<Camera size={18} />
									Scan invite QR
								</button>
							{/if}

							<label class="sharing-label">
								Invite code
								<input type="text" class="sharing-input mono-input" placeholder="Paste the invite code here..." bind:value={privateOfferInput} />
							</label>
							<button class="btn-primary btn-with-icon" onclick={handlePrivateJoin} disabled={!privateOfferInput.trim() || !userName.trim()}>
								Connect
							</button>
						</div>
					{/if}
				</div>
			{/if}
		{/if}

	{:else if status === 'connecting'}
		<div class="sharing-status">
			<div class="connecting-spinner"></div>
			<p class="status-text">{phaseLabel(connectPhase)}</p>
			<button class="btn-text" onclick={handleStop}>Cancel</button>
		</div>

	{:else if status === 'hosting' || status === 'joined'}
		<!-- Connected state (same for both modes) -->
		<div class="sharing-section">
			{#if status === 'hosting' && shareMode === 'quick'}
				{#if qrDataUrl}
					<button class="qr-container" onclick={() => fullscreenQr = qrDataUrl} aria-label="Tap to enlarge QR code">
						<img src={qrDataUrl} alt="QR code for room {roomCode}" class="qr-image" />
					</button>
					<p class="qr-tap-hint">Tap to enlarge</p>
				{/if}

				<div class="code-box">
					<span class="code-box-label">Room code</span>
					<div class="code-row">
						<code class="code-value code-lg">{roomCode}</code>
						<button class="icon-btn" onclick={() => handleCopy(roomCode!, 'Room code')} aria-label="Copy room code">
							<Copy size={16} />
						</button>
					</div>
				</div>

				<div class="share-buttons">
					{#if typeof navigator !== 'undefined' && navigator.share}
						<button class="btn-secondary share-btn" onclick={() => handleNativeShare('Join my contraction timer', `Room: ${roomCode}`, getRoomUrl(roomCode!, password || undefined))}>
							<Share2 size={16} />
							Share link
						</button>
					{/if}
					<button class="btn-secondary share-btn" onclick={() => handleCopy(getRoomUrl(roomCode!, password || undefined), 'Link')}>
						<Copy size={16} />
						Copy link
					</button>
				</div>

				{#if password}
					<div class="code-box">
						<span class="code-box-label">Password</span>
						<div class="code-row">
							<code class="code-value">{password}</code>
							<button class="icon-btn" onclick={() => handleCopy(password, 'Password')} aria-label="Copy password">
								<Copy size={16} />
							</button>
						</div>
						<span class="sharing-hint">Share this with your partner</span>
					</div>
				{/if}

				{#if connectPhase === 'waiting-for-partner'}
					<div class="waiting-hint">
						<div class="connecting-spinner small-spinner"></div>
						Waiting for partner to join...
					</div>
				{/if}
			{:else}
				<div class="joined-header">
					<Wifi size={18} class="connected-icon" />
					<span>
						Connected
						{#if shareMode === 'private'}
							<span class="privacy-badge"><Shield size={12} /> Private</span>
						{/if}
						{#if roomCode}
							to <strong>{roomCode}</strong>
						{/if}
					</span>
				</div>
				{#if status === 'joined'}
					<div class="joined-mode">
						Mode: {currentMode === 'collaborative' ? 'View and edit together' : 'View only'}
					</div>
				{/if}
			{/if}

			{#if copyFeedback}
				<div class="copy-toast">{copyFeedback}</div>
			{/if}

			<div class="peer-list">
				<div class="peer-list-header">
					<Users size={16} />
					<span>Connected ({peers.length})</span>
				</div>
				{#each peers as peer}
					<div class="peer-row">
						<span class="peer-name">
							{peer.name}{peer.isOwner ? ' (host)' : ''}
						</span>
						{#if currentMode === 'view-only' && !peer.isOwner}
							<Eye size={14} class="peer-icon" />
						{:else}
							<Pencil size={14} class="peer-icon" />
						{/if}
					</div>
				{/each}
			</div>

			<button class="btn-danger" onclick={handleStop}>
				{status === 'hosting' ? 'Stop sharing' : 'Disconnect'}
			</button>
		</div>
	{/if}

	{#if scanError}
		<div class="error-banner">{scanError}</div>
	{/if}

	{#if error || localError}
		<div class="error-banner">{error || localError}</div>
	{/if}

	{#if diagnostics}
		<details class="diagnostics-panel">
			<summary class="diagnostics-toggle">Connection details</summary>
			<div class="diagnostics-content">
				{#if diagnostics.ice}
					<div class="diag-row">
						<span class="diag-label">ICE candidates</span>
						<span class="diag-value">{diagnostics.ice.candidateCount} total</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Host (local)</span>
						<span class="diag-value">{diagnostics.ice.hostCandidates}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">STUN (srflx)</span>
						<span class="diag-value" class:diag-warn={diagnostics.ice.srflxCandidates === 0}>{diagnostics.ice.srflxCandidates || 'none'}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">TURN (relay)</span>
						<span class="diag-value" class:diag-warn={diagnostics.ice.relayCandidates === 0}>{diagnostics.ice.relayCandidates || 'none'}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Gather time</span>
						<span class="diag-value">{diagnostics.ice.gatherTimeMs}ms</span>
					</div>
				{/if}
				{#if diagnostics.signalingBackend}
					<div class="diag-row">
						<span class="diag-label">Signaling</span>
						<span class="diag-value">{diagnostics.signalingBackend}</span>
					</div>
				{/if}
				{#if diagnostics.usedFallback}
					<div class="diag-row diag-row-warn">
						<span class="diag-label">Fallback</span>
						<span class="diag-value">Using ntfy.sh (primary unreachable)</span>
					</div>
				{/if}
				{#if diagnostics.failureReason}
					<div class="diag-row diag-row-warn">
						<span class="diag-label">Warning</span>
						<span class="diag-value diag-warn">{diagnostics.failureReason}</span>
					</div>
				{/if}
			</div>
		</details>
	{/if}

	{#if copyFeedback && (status === 'disconnected' || status === 'connecting')}
		<div class="copy-toast floating-toast">{copyFeedback}</div>
	{/if}

	{#if scanning}
		<div class="scan-fullscreen">
			<video bind:this={scanVideoEl} class="scan-video-full" playsinline muted></video>
			<canvas bind:this={scanCanvasEl} class="scan-canvas"></canvas>
			<div class="scan-overlay">
				<div class="scan-frame"></div>
				<p class="scan-hint-text">Point camera at QR code</p>
			</div>
			<button class="scan-close-btn" onclick={stopQRScan} aria-label="Close scanner">
				&times;
			</button>
		</div>
	{:else}
		<canvas bind:this={scanCanvasEl} class="scan-canvas"></canvas>
	{/if}

	{#if fullscreenQr}
		<button class="qr-fullscreen" onclick={() => fullscreenQr = ''} aria-label="Close enlarged QR code">
			<div class="qr-fullscreen-card">
				<img src={fullscreenQr} alt="QR code (enlarged)" class="qr-fullscreen-img" />
			</div>
			<p class="qr-fullscreen-hint">Tap anywhere to close</p>
		</button>
	{/if}
</div>

<style>
	.sharing-panel {
		padding: var(--space-4);
	}

	/* Action cards (menu view) */
	.action-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-5) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--bg-card);
		cursor: pointer;
		transition: border-color 150ms, background 150ms, transform 150ms;
		-webkit-tap-highlight-color: transparent;
		color: var(--text-secondary);
	}

	.action-card:active {
		transform: scale(0.97);
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.action-card :global(svg) {
		color: var(--accent);
	}

	.action-card-title {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--text-primary);
	}

	.action-card-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
		text-align: center;
		line-height: 1.3;
	}

	/* Back link */
	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) 0;
		margin-bottom: var(--space-2);
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.back-link:active {
		color: var(--text-secondary);
	}

	/* Share live card (menu view) */
	.live-card {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3) var(--space-4);
		margin-top: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--bg-card);
		cursor: pointer;
		transition: border-color 150ms, background 150ms, transform 150ms;
		-webkit-tap-highlight-color: transparent;
		color: var(--text-secondary);
		text-align: left;
	}

	.live-card:active {
		transform: scale(0.98);
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.live-card :global(svg) {
		flex-shrink: 0;
		color: var(--accent);
	}

	.live-card-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.live-card-title {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--text-primary);
	}

	.live-card-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
	}

	/* Private connect link (in live-quick view) */
	.private-connect-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}

	/* Private connect explainer */
	.private-explainer {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--bg-card);
		margin-bottom: var(--space-3);
	}

	.private-explainer-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
		color: var(--accent);
	}

	.private-explainer-title {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--text-primary);
	}

	.private-explainer-desc {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0 0 var(--space-3);
	}

	.private-explainer-details {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.private-detail {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.private-detail-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent-muted);
		color: var(--accent);
		font-size: 10px;
		font-weight: 700;
		flex-shrink: 0;
	}

	.private-warning {
		padding: var(--space-3);
		background: var(--danger-muted);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-2);
	}

	.private-warning-header {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--danger);
		margin-bottom: var(--space-2);
	}

	.private-warning-text {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0 0 var(--space-2);
	}

	.private-warning-text:last-child {
		margin-bottom: 0;
	}

	.private-warning-text strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	.private-turn-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		line-height: 1.5;
	}

	.private-turn-hint summary {
		cursor: pointer;
		font-weight: 500;
		color: var(--text-muted);
		-webkit-tap-highlight-color: transparent;
		padding: var(--space-1) 0;
	}

	.private-turn-hint p {
		margin: var(--space-1) 0 0;
		color: var(--text-muted);
	}

	.private-turn-hint em {
		font-style: italic;
	}

	/* Snapshot / Live divider */
	.sharing-divider-section {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-3) 0;
		color: var(--text-faint);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.sharing-divider-section::before,
	.sharing-divider-section::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.sharing-divider-label {
		white-space: nowrap;
		text-transform: lowercase;
	}

	/* Mode tabs */
	.mode-tabs {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1);
		background: var(--bg-card);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-3);
	}

	.mode-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: background 150ms, color 150ms;
	}

	.mode-tab-active {
		background: var(--bg-primary);
		color: var(--text-primary);
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	.mode-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
		text-align: center;
		margin-bottom: var(--space-4);
		line-height: 1.4;
	}

	/* Sections */
	.sharing-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.sharing-heading {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.sharing-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
	}

	.sharing-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		font-weight: 400;
	}

	.sharing-input {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		color: var(--text-primary);
		font-size: var(--text-base);
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}

	.sharing-input:focus {
		border-color: var(--accent);
	}

	.sharing-input::placeholder {
		color: var(--text-faint);
	}

	.sharing-select {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		color: var(--text-primary);
		font-size: var(--text-sm);
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}

	.mono-input {
		font-family: monospace;
		font-size: var(--text-sm);
	}

	/* Password field */
	.password-field {
		position: relative;
		display: flex;
		align-items: center;
	}

	.password-field .sharing-input {
		padding-right: calc(var(--space-7) + var(--space-6));
	}

	.password-toggle {
		position: absolute;
		right: var(--space-2);
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
	}

	.password-action {
		position: absolute;
		right: calc(var(--space-2) + var(--btn-height-sm));
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
		-webkit-tap-highlight-color: transparent;
	}

	.password-action:active {
		color: var(--accent);
		background: var(--accent-muted);
	}

	/* Mode radios */
	.mode-radios {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.mode-radio {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		-webkit-tap-highlight-color: transparent;
	}

	.mode-radio input[type="radio"] {
		accent-color: var(--accent);
	}

	.mode-radio.mode-selected {
		border-color: var(--accent);
		background: var(--accent-muted);
		color: var(--accent);
	}

	.mode-radio :global(svg) {
		flex-shrink: 0;
	}

	/* Advanced settings */
	.advanced-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) 0;
		border: none;
		background: none;
		color: var(--text-faint);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.advanced-toggle:active {
		color: var(--text-muted);
	}

	.advanced-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	/* Buttons */
	.btn-primary {
		padding: var(--space-3);
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

	.btn-secondary {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		color: var(--text-secondary);
		font-size: var(--text-base);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary:active:not(:disabled) {
		background: var(--bg-card-hover);
	}

	.btn-danger {
		padding: var(--space-3);
		border: none;
		border-radius: var(--radius-md);
		background: var(--danger-muted);
		color: var(--danger);
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-danger:active {
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

	/* Divider */
	.sharing-divider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-4) 0;
		color: var(--text-faint);
		font-size: var(--text-sm);
	}

	.sharing-divider::before,
	.sharing-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	/* Step labels (Private mode) */
	.step-label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
	}

	.step-2 {
		margin-top: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}

	.private-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.waiting-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		text-align: center;
		font-size: var(--text-sm);
		color: var(--text-faint);
		font-style: italic;
	}

	.small-spinner {
		width: var(--space-3);
		height: var(--space-3);
		border-width: 2px;
	}

	/* Connecting */
	.sharing-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-6) 0;
	}

	.connecting-spinner {
		width: var(--space-6);
		height: var(--space-6);
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.status-text {
		font-size: var(--text-base);
		color: var(--text-muted);
	}

	/* QR code */
	.qr-container {
		display: flex;
		justify-content: center;
		padding: var(--space-3);
		background: white;
		border-radius: var(--radius-lg);
		align-self: center;
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

	.qr-tap-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		text-align: center;
		margin: 0;
		margin-top: calc(-1 * var(--space-1));
	}

	/* Fullscreen QR viewer */
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

	/* Code display */
	.code-box {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.code-box-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

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

	/* Share buttons */
	.share-buttons {
		display: flex;
		gap: var(--space-2);
	}

	.share-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	.copy-toast {
		text-align: center;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent);
		animation: fadeIn 200ms ease-out;
	}

	.floating-toast {
		margin-top: var(--space-2);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* Peer list */
	.peer-list {
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.peer-list-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-card);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border);
	}

	.peer-list-header :global(svg) {
		color: var(--text-muted);
	}

	.peer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.peer-row + .peer-row {
		border-top: 1px solid var(--border);
	}

	.peer-name {
		font-weight: 500;
	}

	.peer-row :global(.peer-icon) {
		color: var(--text-faint);
	}

	/* Joined view */
	.joined-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-base);
		color: var(--text-primary);
	}

	.joined-header :global(.connected-icon) {
		color: var(--success, var(--accent));
	}

	.joined-mode {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.privacy-badge {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--success, var(--accent));
		background: var(--success-muted, var(--accent-muted));
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		margin-left: var(--space-1);
	}

	/* Invite banner */
	.invite-banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--accent-muted);
		color: var(--accent);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.name-required {
		color: var(--accent);
		font-weight: 500;
	}

	/* Step 2 actions (connect + scan) */
	.step2-actions {
		display: flex;
		gap: var(--space-2);
	}

	.step2-connect {
		flex: 1;
	}

	.scan-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-height, 48px);
		padding: 0;
		flex-shrink: 0;
	}

	/* QR Scanner (fullscreen overlay) */
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

	.scan-hint-text {
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

	/* Action buttons (Share + Join side by side) */
	.action-buttons {
		display: flex;
		gap: var(--space-2);
	}

	.action-buttons .btn-primary,
	.action-buttons .btn-secondary {
		flex: 1;
	}

	.btn-active {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Expandable section below action buttons */
	.expand-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--accent-muted);
		border-radius: var(--radius-md);
		animation: slideDown 200ms ease-out;
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Scan QR button (join section) */
	.btn-scan-qr {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-scan-qr:active {
		background: var(--bg-card-hover);
		color: var(--text-secondary);
	}

	/* Button with inline icon/spinner */
	.btn-with-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	.btn-with-icon :global(.spin-icon) {
		animation: spin 0.8s linear infinite;
	}

	/* Error */
	.error-banner {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--danger-muted);
		color: var(--danger);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	/* Custom TURN fields */
	.custom-turn-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) 0;
	}

	/* Setup guide toggle */
	.setup-guide-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-2) 0;
		border: none;
		background: none;
		color: var(--text-faint);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		border-top: 1px solid var(--border);
		margin-top: var(--space-1);
		padding-top: var(--space-3);
	}

	.setup-guide-toggle:active {
		color: var(--text-muted);
	}

	/* Setup guide tiers */
	.setup-guide {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		animation: slideDown 200ms ease-out;
	}

	.tier-card {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
	}

	.tier-card.tier-recommended {
		border-color: var(--accent-muted);
		background: var(--accent-muted);
	}

	.tier-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.tier-badge {
		font-size: var(--text-xs);
		font-weight: 700;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.tier-basic {
		background: var(--bg-card-hover);
		color: var(--text-muted);
	}

	.tier-cf {
		background: var(--accent);
		color: white;
	}

	.tier-self {
		background: var(--bg-card-hover);
		color: var(--text-muted);
	}

	.tier-label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
	}

	.tier-desc {
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: 1.4;
		margin: 0 0 var(--space-2);
	}

	.tier-config {
		font-size: var(--text-xs);
		color: var(--text-faint);
		font-family: monospace;
	}

	.tier-steps {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.tier-step {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
	}

	.tier-step-num {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		font-size: var(--text-xs);
		font-weight: 700;
		flex-shrink: 0;
	}

	.tier-step-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tier-step-title {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
	}

	.tier-step-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
		line-height: 1.5;
	}

	.tier-step-desc a {
		color: var(--accent);
		text-decoration: underline;
		font-weight: 500;
	}

	.tier-step-desc code {
		font-family: monospace;
		font-size: 0.85em;
		background: var(--bg-card-hover);
		padding: 1px 4px;
		border-radius: 3px;
	}

	.tier-faq {
		margin-top: var(--space-2);
		border-top: 1px solid var(--border);
		padding-top: var(--space-2);
	}

	.tier-faq details {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.tier-faq summary {
		cursor: pointer;
		font-weight: 500;
		-webkit-tap-highlight-color: transparent;
	}

	.tier-deploy-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-size: var(--text-xs);
		font-weight: 600;
		text-decoration: none;
		margin-top: var(--space-1);
		-webkit-tap-highlight-color: transparent;
	}

	.tier-deploy-btn:active {
		filter: brightness(0.9);
	}

	.tier-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
	}

	.tier-link:active {
		text-decoration: underline;
	}

	/* Test result */
	.test-result {
		font-size: var(--text-xs);
		font-weight: 600;
		text-align: center;
		padding: var(--space-1);
		border-radius: var(--radius-sm);
	}

	.test-ok {
		color: var(--success, var(--accent));
		background: var(--success-muted, var(--accent-muted));
	}

	.test-fail {
		color: var(--danger);
		background: var(--danger-muted);
	}

	/* Diagnostics panel */
	.diagnostics-panel {
		margin-top: var(--space-3);
	}

	.diagnostics-toggle {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--text-faint);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		padding: var(--space-1) 0;
	}

	.diagnostics-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		margin-top: var(--space-1);
		font-size: var(--text-xs);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}

	.diag-label {
		color: var(--text-muted);
		font-weight: 500;
	}

	.diag-value {
		color: var(--text-primary);
		font-family: monospace;
	}

	.diag-warn {
		color: var(--danger);
	}

	.diag-row-warn {
		padding: var(--space-1) 0;
	}
</style>
