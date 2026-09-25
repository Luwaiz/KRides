import { doc, onSnapshot } from "firebase/firestore";
import { FIREBASE_DB } from "../firebaseConfig";
import { setPricingConfig } from "./pricingState";

export { getPricingConfig, PRICING_DEFAULTS } from "./pricingState";

export function startPricingConfigListener() {
	return onSnapshot(
		doc(FIREBASE_DB, "config", "pricing"),
		(snap) => {
			if (snap.exists()) {
				setPricingConfig(snap.data());
			}
		},
		() => {
		}
	);
}
