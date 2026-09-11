// Pure in-memory pricing state — deliberately no Firebase import, so
// anything that just needs the current numbers (rideCalculations.js,
// commission.js) doesn't pull in Firebase (and everything that drags along,
// like RN's AsyncStorage-backed auth persistence) just to do arithmetic.
// constants/pricingConfig.js owns the Firestore listener and calls
// setPricingConfig() when it gets an update — this file only holds state.
export const PRICING_DEFAULTS = {
	baseFarePerPassenger: 200,
	platformFeeStandard: 100,
	platformFeeGroup: 150,
	groupThreshold: 3,
};

let current = { ...PRICING_DEFAULTS };

export function getPricingConfig() {
	return current;
}

export function setPricingConfig(next) {
	current = { ...PRICING_DEFAULTS, ...next };
}
