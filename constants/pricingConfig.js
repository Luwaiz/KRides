import { doc, onSnapshot } from "firebase/firestore";
import { FIREBASE_DB } from "../firebaseConfig";
import { setPricingConfig } from "./pricingState";

export { getPricingConfig, PRICING_DEFAULTS } from "./pricingState";

/**
 * Starts a live listener on config/pricing and keeps the pricing state
 * (constants/pricingState.js) in sync with whatever admin-web's Pricing
 * page has set. Called once at app boot (see App.js) — every call site
 * that computes a fare or driver-earnings figure reads through
 * getPricingConfig() rather than needing this threaded in.
 * If the doc doesn't exist yet (nobody's touched Pricing in admin-web) or
 * the listener errors, state just stays at PRICING_DEFAULTS — pricing
 * never goes blank/zero from this failing.
 */
export function startPricingConfigListener() {
	return onSnapshot(
		doc(FIREBASE_DB, "config", "pricing"),
		(snap) => {
			if (snap.exists()) {
				setPricingConfig(snap.data());
			}
		},
		() => {
			// Non-fatal — keep using whatever config was last known (or defaults).
		}
	);
}
