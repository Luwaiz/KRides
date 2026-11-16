import { getDriverScreen } from "../driverGate";

const user = { uid: "d1" };

describe("getDriverScreen", () => {
	it("sends a driver with verified bank details to the dashboard", () => {
		expect(getDriverScreen(user, "d1", true)).toBe("dashboard");
	});

	it("sends a driver without verified bank details to the bank screen", () => {
		expect(getDriverScreen(user, "d1", false)).toBe("bank");
	});

	it("treats anything other than an explicit true as not verified", () => {
		for (const value of [undefined, null, 0, "", "true", 1]) {
			expect(getDriverScreen(user, "d1", value)).toBe("bank");
		}
	});

	it("waits instead of guessing while the profile hasn't loaded", () => {
		expect(getDriverScreen(user, "", false)).toBe("loading");
		expect(getDriverScreen(user, "", true)).toBe("loading");
		expect(getDriverScreen(user, undefined, true)).toBe("loading");
	});

	it("never trusts another account's profile, even a verified one", () => {
		expect(getDriverScreen(user, "someone-else", true)).toBe("loading");
	});

	it("shows nothing for a missing or incomplete user", () => {
		expect(getDriverScreen(null, "d1", true)).toBe("loading");
		expect(getDriverScreen({}, "", true)).toBe("loading");
	});
});
