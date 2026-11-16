import { useDriverDetails } from "../Store";

const driver = { uid: "d1", fullname: "Ade", email: "a@b.c", phone: "0801" };

beforeEach(() => useDriverDetails.getState().clearDriver());

describe("driver store bank verification", () => {
	it("takes verification from the profile", () => {
		useDriverDetails.getState().setDriverProfile({ ...driver, bankDetailsVerified: true });
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(true);
	});

	it("is not verified unless the profile says so", () => {
		useDriverDetails.getState().setDriverProfile(driver);
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(false);
	});

	it("is not undone by a stale update for the same driver (cache lagging a server save)", () => {
		const { setDriverProfile } = useDriverDetails.getState();
		setDriverProfile({ ...driver, bankDetailsVerified: true });
		setDriverProfile({ ...driver, bankDetailsVerified: undefined });
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(true);
	});

	it("never carries verification over to a different driver", () => {
		const { setDriverProfile } = useDriverDetails.getState();
		setDriverProfile({ ...driver, bankDetailsVerified: true });
		setDriverProfile({ ...driver, uid: "d2" });
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(false);
	});

	it("does not keep verification from an update with no uid", () => {
		const { setDriverProfile } = useDriverDetails.getState();
		setDriverProfile({ ...driver, bankDetailsVerified: true });
		setDriverProfile({ fullname: "Ade" });
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(false);
	});

	it("is cleared on sign-out", () => {
		const { setDriverProfile, clearDriver } = useDriverDetails.getState();
		setDriverProfile({ ...driver, bankDetailsVerified: true });
		clearDriver();
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(false);
		setDriverProfile(driver);
		expect(useDriverDetails.getState().bankDetailsVerified).toBe(false);
	});
});
