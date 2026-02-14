/**
 * Private Connect: No-signaling-server WebRTC connection.
 *
 * Uses raw RTCPeerConnection with STUN (for reliable ICE candidates)
 * but NO signaling server. Both parties exchange SDP offer/answer codes
 * manually (QR, copy-paste, link).
 *
 * STUN is just an IP lookup — it doesn't see session data or room info.
 * The key privacy benefit vs Quick Connect is: no third-party signaling
 * server knows who is connecting to whom.
 *
 * Flow:
 * 1. Host calls createPrivateOffer() → gets offerCode + waitForAnswer()
 * 2. Guest calls acceptPrivateOffer(offerCode) → gets answerCode + connection
 * 3. Host calls waitForAnswer(answerCode) → connection established
 * 4. Both have an open RTCDataChannel for Y.js sync
 */

import { compressOffer, decompressOffer, compressAnswer, decompressAnswer } from './sdp-compress';
import { buildRtcConfig } from './ice-config';
import type { IceGatheringResult } from './diagnostics';

// Always log private-connect events — these are rare user-initiated actions, not spam
function debug(...args: unknown[]) { console.debug('[private-connect]', ...args); }

export interface PrivateConnection {
	pc: RTCPeerConnection;
	channel: RTCDataChannel;
	cleanup: () => void;
}

/** Max time to wait for ICE gathering (ms).
 * TURN relay allocation can take 15-25s on slow networks or first use.
 * 45s is generous but the UI shows progress, so acceptable. */
const ICE_GATHER_TIMEOUT = 45000;

/** Wait for ICE gathering to complete (or timeout).
 * Returns diagnostics about what candidate types were gathered. */
function waitForIceGathering(pc: RTCPeerConnection): Promise<IceGatheringResult> {
	const startTime = performance.now();
	return new Promise((resolve) => {
		let resolved = false;
		let hostCandidates = 0;
		let srflxCandidates = 0;
		let relayCandidates = 0;
		let candidateCount = 0;

		const finish = () => {
			if (resolved) return;
			resolved = true;
			const result: IceGatheringResult = {
				candidateCount,
				hostCandidates,
				srflxCandidates,
				relayCandidates,
				gatherTimeMs: Math.round(performance.now() - startTime),
			};
			debug(`ICE gathering done — ${candidateCount} candidates (host: ${hostCandidates}, srflx: ${srflxCandidates}, relay: ${relayCandidates}) in ${result.gatherTimeMs}ms`);
			resolve(result);
		};

		if (pc.iceGatheringState === 'complete') {
			finish();
			return;
		}

		const maxTimeout = setTimeout(finish, ICE_GATHER_TIMEOUT);

		pc.addEventListener('icecandidate', (event) => {
			if (event.candidate) {
				candidateCount++;
				const c = event.candidate;
				debug(`ICE candidate #${candidateCount}: ${c.type} ${c.protocol} ${c.address ?? '?'}:${c.port}`);
				if (c.type === 'host') hostCandidates++;
				if (c.type === 'srflx') srflxCandidates++;
				if (c.type === 'relay') relayCandidates++;
			}
		});

		pc.addEventListener('icegatheringstatechange', () => {
			if (pc.iceGatheringState === 'complete' && !resolved) {
				clearTimeout(maxTimeout);
				finish();
			}
		});
	});
}

/** Wait for a data channel to open */
function waitForChannelOpen(channel: RTCDataChannel): Promise<void> {
	return new Promise((resolve, reject) => {
		if (channel.readyState === 'open') {
			resolve();
			return;
		}

		const timeout = setTimeout(() => {
			reject(new Error('Data channel open timed out (60s) — TURN relay may be unreachable'));
		}, 60000);

		channel.addEventListener('open', () => {
			clearTimeout(timeout);
			resolve();
		}, { once: true });

		channel.addEventListener('error', (e) => {
			clearTimeout(timeout);
			reject(new Error(`Data channel error: ${(e as RTCErrorEvent).error?.message || 'unknown'}`));
		}, { once: true });
	});
}

/**
 * HOST: Create a private offer.
 * Returns the compressed offer code and a function to complete the handshake.
 * @param iceConfigOverride Optional RTCConfiguration to use instead of stored preferences.
 */
export async function createPrivateOffer(iceConfigOverride?: RTCConfiguration): Promise<{
	offerCode: string;
	iceResult: IceGatheringResult;
	waitForAnswer: (answerCode: string) => Promise<PrivateConnection>;
	cancel: () => void;
}> {
	const iceConfig = iceConfigOverride ?? await buildRtcConfig();
	debug('Creating private offer, ICE servers:', iceConfig.iceServers?.length ?? 0);

	const pc = new RTCPeerConnection(iceConfig);
	let cancelled = false;

	// Create the data channel (host creates it)
	const channel = pc.createDataChannel('ct-sync', {
		ordered: true,
	});

	// Log ICE/connection state changes for debugging
	pc.addEventListener('iceconnectionstatechange', () => {
		debug('Host ICE connection state:', pc.iceConnectionState);
	});
	pc.addEventListener('connectionstatechange', () => {
		debug('Host connection state:', pc.connectionState);
	});

	debug('Creating SDP offer...');
	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);
	debug('Local description set, signalingState:', pc.signalingState);

	// Wait for ICE candidates to be gathered
	const iceResult = await waitForIceGathering(pc);
	debug('Post-ICE signalingState:', pc.signalingState);

	const localSDP = pc.localDescription?.sdp;
	if (!localSDP) throw new Error('Failed to generate local SDP');

	debug('Local SDP generated, length:', localSDP.length);
	const offerCode = compressOffer(localSDP);
	debug('Offer code length:', offerCode.length);

	// Warn if no relay candidates and TURN was expected
	if (iceResult.relayCandidates === 0 && iceConfig.iceServers && iceConfig.iceServers.some(s => {
		const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
		return urls.some(u => u.startsWith('turn:'));
	})) {
		debug('WARNING: TURN servers configured but no relay candidates gathered — cross-network connections may fail');
	}

	const waitForAnswer = async (answerCode: string): Promise<PrivateConnection> => {
		if (cancelled) throw new Error('Connection was cancelled');

		debug('waitForAnswer called, signalingState:', pc.signalingState, 'connectionState:', pc.connectionState);

		if (pc.signalingState !== 'have-local-offer') {
			throw new Error(
				`Connection expired (state: ${pc.signalingState}). Please create a new invite.`
			);
		}

		debug('Received answer code, length:', answerCode.length);
		const answerSDP = decompressAnswer(answerCode);
		debug('Decompressed answer SDP, length:', answerSDP.length);

		await pc.setRemoteDescription({
			type: 'answer',
			sdp: answerSDP,
		});

		debug('Waiting for data channel to open...');
		await waitForChannelOpen(channel);
		debug('Data channel open!');

		return {
			pc,
			channel,
			cleanup: () => {
				channel.close();
				pc.close();
			},
		};
	};

	const cancel = () => {
		cancelled = true;
		channel.close();
		pc.close();
	};

	return { offerCode, iceResult, waitForAnswer, cancel };
}

/**
 * GUEST: Accept a private offer and generate an answer.
 * Returns the compressed answer code and the connection (once the channel opens).
 * @param iceConfigOverride Optional RTCConfiguration to use instead of stored preferences.
 */
export async function acceptPrivateOffer(offerCode: string, iceConfigOverride?: RTCConfiguration): Promise<{
	answerCode: string;
	iceResult: IceGatheringResult;
	waitForConnection: () => Promise<PrivateConnection>;
	cancel: () => void;
}> {
	debug('Accepting private offer, code length:', offerCode.length);

	let offerSDP: string;
	try {
		offerSDP = decompressOffer(offerCode);
		debug('Decompressed offer SDP, length:', offerSDP.length);
		debug('Offer SDP:\n', offerSDP);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[private-connect] Failed to decompress offer code:', msg);
		throw new Error(`Invalid invite code: ${msg}`);
	}

	const iceConfig = iceConfigOverride ?? await buildRtcConfig();
	debug('ICE servers for answer:', iceConfig.iceServers?.length ?? 0);

	const pc = new RTCPeerConnection(iceConfig);
	let cancelled = false;
	let resolveChannel: ((channel: RTCDataChannel) => void) | null = null;

	// Guest receives the data channel from the host
	const channelPromise = new Promise<RTCDataChannel>((resolve) => {
		resolveChannel = resolve;
	});

	pc.addEventListener('datachannel', (event) => {
		debug('Received data channel from host');
		resolveChannel?.(event.channel);
	});

	// Log ICE connection state changes for debugging
	pc.addEventListener('iceconnectionstatechange', () => {
		debug('ICE connection state:', pc.iceConnectionState);
	});
	pc.addEventListener('connectionstatechange', () => {
		debug('Connection state:', pc.connectionState);
	});

	try {
		await pc.setRemoteDescription({
			type: 'offer',
			sdp: offerSDP,
		});
		debug('Remote description set successfully');
	} catch (e) {
		pc.close();
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[private-connect] setRemoteDescription failed:', msg, '\nSDP:', offerSDP);
		throw new Error(`Failed to process invite: ${msg}`);
	}

	debug('Creating SDP answer...');
	const answer = await pc.createAnswer();
	await pc.setLocalDescription(answer);

	// Wait for ICE candidates
	const iceResult = await waitForIceGathering(pc);

	const localSDP = pc.localDescription?.sdp;
	if (!localSDP) {
		pc.close();
		throw new Error('Failed to generate answer SDP');
	}

	debug('Answer SDP generated, length:', localSDP.length);
	debug('Answer SDP:\n', localSDP);
	const answerCode = compressAnswer(localSDP);
	debug('Answer code length:', answerCode.length);

	const waitForConnection = async (): Promise<PrivateConnection> => {
		if (cancelled) throw new Error('Connection was cancelled');

		debug('Waiting for data channel from host...');
		const channel = await channelPromise;

		debug('Waiting for channel to open...');
		await waitForChannelOpen(channel);
		debug('Data channel open (guest)!');

		return {
			pc,
			channel,
			cleanup: () => {
				channel.close();
				pc.close();
			},
		};
	};

	const cancel = () => {
		cancelled = true;
		pc.close();
	};

	return { answerCode, iceResult, waitForConnection, cancel };
}
