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
