import { Alert } from "react-native";


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
	}
}

export function installGlobalErrorHandlers() {
	if (installed) return;
	installed = true;

	if (typeof ErrorUtils !== "undefined" && ErrorUtils.getGlobalHandler) {
		const originalHandler = ErrorUtils.getGlobalHandler();
		ErrorUtils.setGlobalHandler((error, isFatal) => {
			console.error(isFatal ? "🔥 Fatal error:" : "🔥 Uncaught error:", error);
			if (!isFatal) {
				showThrottledAlert(
					"Something Went Wrong",
					"An unexpected error occurred. Please try again."
				);
			}
			originalHandler?.(error, isFatal);
		});
	}

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
