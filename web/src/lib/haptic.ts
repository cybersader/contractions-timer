export function haptic(ms = 50): void {
	try {
		navigator?.vibrate?.(ms);
	} catch { /* not supported */ }
}
