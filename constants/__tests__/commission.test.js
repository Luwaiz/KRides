import {
	calculateDriverEarnings,
	calculatePlatformFee,
	getRideDriverEarnings,
	formatNaira,
} from "../commission";
import { calculateFare } from "../../helpers/rideCalculations";
import { PRICING_DEFAULTS, setPricingConfig } from "../pricingState";

beforeEach(() => setPricingConfig(PRICING_DEFAULTS));

describe("fare, platform fee and driver earnings agree", () => {
	// Defaults: ₦200 per passenger, fee ₦100 (₦150 from 3 passengers).
	it.each([
		[1, 300, 100, 200],
		[2, 500, 100, 400],
		[3, 750, 150, 600],
		[4, 950, 150, 800],
	])("%i passenger(s): fare %i, fee %i, driver earns %i", (passengers, fare, fee, earns) => {
		expect(calculateFare(0, passengers)).toBe(fare);
		expect(calculatePlatformFee(fare, passengers)).toBe(fee);
		expect(calculateDriverEarnings(fare, passengers)).toBe(earns);
		// The driver always earns exactly the per-passenger fares.
		expect(earns).toBe(PRICING_DEFAULTS.baseFarePerPassenger * passengers);
		expect(earns + fee).toBe(fare);
	});

	it("follows the configured prices", () => {
		setPricingConfig({ baseFarePerPassenger: 300, platformFeeStandard: 50, platformFeeGroup: 80, groupThreshold: 2 });
		expect(calculateFare(0, 1)).toBe(350);
		expect(calculateFare(0, 2)).toBe(680);
		expect(calculateDriverEarnings(680, 2)).toBe(600);
	});

	it("never goes negative or earns on a zero fare", () => {
		expect(calculateDriverEarnings(0, 1)).toBe(0);
		expect(calculateDriverEarnings(50, 1)).toBe(0);
		expect(calculatePlatformFee(0, 1)).toBe(0);
	});
});

describe("getRideDriverEarnings", () => {
	it("uses the figure the server recorded at completion", () => {
		expect(getRideDriverEarnings({ amount: 300, numberOfPassengers: 1, driverEarnings: 200 })).toBe(200);
	});

	it("is not changed by later edits to the fee settings", () => {
		const ride = { amount: 300, numberOfPassengers: 1, driverEarnings: 200 };
		setPricingConfig({ ...PRICING_DEFAULTS, platformFeeStandard: 250 });
		expect(getRideDriverEarnings(ride)).toBe(200);
	});

	it("calculates for rides that don't have it yet", () => {
		expect(getRideDriverEarnings({ amount: 750, numberOfPassengers: 3 })).toBe(600);
		expect(getRideDriverEarnings({ amount: 300 })).toBe(200);
		expect(getRideDriverEarnings({ amount: 750, number_of_passengers: 3 })).toBe(600);
	});

	it("treats a recorded zero as zero rather than recalculating", () => {
		expect(getRideDriverEarnings({ amount: 300, numberOfPassengers: 1, driverEarnings: 0 })).toBe(0);
	});

	it("ignores a recorded value that isn't a number", () => {
		expect(getRideDriverEarnings({ amount: 300, driverEarnings: "200" })).toBe(200);
		expect(getRideDriverEarnings({ amount: 300, driverEarnings: NaN })).toBe(200);
	});

	it("handles missing rides and amounts", () => {
		expect(getRideDriverEarnings(null)).toBe(0);
		expect(getRideDriverEarnings({})).toBe(0);
		expect(getRideDriverEarnings({ amount: "300" })).toBe(200);
	});
});

describe("formatNaira", () => {
	it("adds thousands separators", () => {
		expect(formatNaira(1500)).toBe("₦1,500");
		expect(formatNaira(1234567)).toBe("₦1,234,567");
	});

	it("rounds and copes with bad input", () => {
		expect(formatNaira(199.6)).toBe("₦200");
		expect(formatNaira(0)).toBe("₦0");
		expect(formatNaira(undefined)).toBe("₦0");
		expect(formatNaira("abc")).toBe("₦0");
	});
});
