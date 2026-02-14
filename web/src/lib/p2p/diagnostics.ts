/**
 * Connection diagnostics for P2P troubleshooting.
 * Collects ICE gathering stats, signaling reachability, and timing info.
 */

export interface IceGatheringResult {
	candidateCount: number;
	hostCandidates: number;
	srflxCandidates: number;
	relayCandidates: number;
	gatherTimeMs: number;
}

export interface ConnectionDiagnostics {
	/** ICE gathering results (null if not yet gathered) */
	ice: IceGatheringResult | null;
	/** Signaling backend name */
	signalingBackend: string | null;
	/** Whether signaling is reachable (null = not tested) */
	signalingReachable: boolean | null;
	/** Signaling round-trip time in ms (null = not tested) */
	signalingLatencyMs: number | null;
	/** Human-readable failure reason (null = no failure) */
	failureReason: string | null;
	/** Whether a signaling fallback was used */
	usedFallback: boolean;
}

export const EMPTY_DIAGNOSTICS: ConnectionDiagnostics = {
	ice: null,
	signalingBackend: null,
	signalingReachable: null,
	signalingLatencyMs: null,
	failureReason: null,
	usedFallback: false,
};
