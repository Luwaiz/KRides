import { Alert } from "react-native";

// The app's ErrorBoundary (components/ErrorBoundary.js) only catches errors
// thrown during React's render phase. An error thrown inside an onPress
// handler, a useEffect's async body, or a promise with no .catch() anywhere
// in its chain bypasses it entirely — in production that previously meant
// the action just silently did nothing, with no feedback and nothing logged
// anywhere useful. This installs the two handlers that catch those cases.

let installed = false;
let lastAlertAt = 0;
const ALERT_THROTTLE_MS = 4000;

function showThrottledAlert(title, message) {
	const now = Date.now();
	if (now - lastAlertAt < ALERT_THROTTLE_MS) return;
	lastAlertAt = now;
	try {
		Alert.alert(title, message);
	} catch {
		// Alert itself can fail very early in bootstrap — nothing more to do.
	}
}

export function installGlobalErrorHandlers() {
	if (installed) return;
	installed = true;

	// Uncaught synchronous JS errors outside React's render tree.
	if (typeof ErrorUtils !== "undefined" && ErrorUtils.getGlobalHandler) {
		const originalHandler = ErrorUtils.getGlobalHandler();
		ErrorUtils.setGlobalHandler((error, isFatal) => {
			console.error(isFatal ? "🔥 Fatal error:" : "🔥 Uncaught error:", error);
			// Fatal errors already crash/restart the app via RN's own redbox or
			// native crash handling — an alert on top of that isn't useful.
			if (!isFatal) {
				showThrottledAlert(
					"Something Went Wrong",
					"An unexpected error occurred. Please try again."
				);
			}
			originalHandler?.(error, isFatal);
		});
	}

	// Unhandled promise rejections (a rejected promise with no .catch()
	// anywhere in the chain). Ships as part of RN's own `promise` dependency.
	try {
		const rejectionTracking = require("promise/setimmediate/rejection-tracking");
		rejectionTracking.enable({
			allRejections: true,
			onUnhandled: (id, error) => {
				console.error("🔥 Unhandled promise rejection:", error);
			},
			onHandled: () => {},
		});
	} catch (e) {
		console.warn("⚠️ Could not enable promise rejection tracking:", e.message);
	}
}
