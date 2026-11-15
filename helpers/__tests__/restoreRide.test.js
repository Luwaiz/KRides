jest.mock("../firebaseRides", () => ({ getUnfinishedRides: jest.fn() }));
jest.mock("../getLocationCoordinates", () => ({ getRideCoordinates: jest.fn() }));

import { getUnfinishedRides } from "../firebaseRides";
import { getRideCoordinates } from "../getLocationCoordinates";
import { restoreCustomerRide, restoreDriverRide } from "../restoreRide";
import {
	useActiveRideStore,
	useAcceptedRideStore,
	useRideDetailsStore,
} from "../../constants/Store";

const coords = (lat, lng) => ({ latitude: lat, longitude: lng });

beforeEach(() => {
	jest.clearAllMocks();
	useActiveRideStore.getState().clearActiveRide();
	useAcceptedRideStore.getState().clearAcceptedRide();
	useAcceptedRideStore.getState().clearNextRide();
	useRideDetailsStore.getState().resetRideDetails();
});

describe("restoreCustomerRide", () => {
	it("restores the newest unfinished ride with its driver and map pins", async () => {
		getUnfinishedRides.mockResolvedValue([
			{ rideId: "old", status: "pending" },
			{
				rideId: "r1", status: "accepted", driverId: "d1", driverName: "Ade",
				driverPhone: "080", vehicleId: "Z9", hasArrived: false,
				pickupLocation: "Gate", destination: "Library",
				pickupCoords: coords(6.89, 3.72), destinationCoords: coords(6.9, 3.73),
			},
		]);

		const ride = await restoreCustomerRide("u1");

		expect(getUnfinishedRides).toHaveBeenCalledWith("u1", "customer");
		expect(ride.rideId).toBe("r1");
		const { activeRide, rideStatus } = useActiveRideStore.getState();
		expect(activeRide).toMatchObject({ rideId: "r1", driverId: "d1", driverName: "Ade" });
		expect(rideStatus).toBe("accepted");
		expect(useRideDetailsStore.getState().pickupLocation).toMatchObject({ name: "Gate", latitude: 6.89 });
	});

	it("does nothing when a ride is already showing", async () => {
		useActiveRideStore.getState().setActiveRide({ rideId: "live", status: "pending" });
		expect(await restoreCustomerRide("u1")).toBeNull();
		expect(getUnfinishedRides).not.toHaveBeenCalled();
	});

	it("does nothing when there is no unfinished ride", async () => {
		getUnfinishedRides.mockResolvedValue([]);
		expect(await restoreCustomerRide("u1")).toBeNull();
		expect(useActiveRideStore.getState().activeRide).toBeNull();
	});
});

describe("restoreDriverRide", () => {
	it("makes the ride under way current and queues the other", async () => {
		getUnfinishedRides.mockResolvedValue([
			{ rideId: "a", status: "accepted", pickupCoords: coords(6.8, 3.7), destinationCoords: coords(6.9, 3.8) },
			{ rideId: "b", status: "in_progress", hasArrived: true, pickupCoords: coords(6.8, 3.7), destinationCoords: coords(6.9, 3.8) },
		]);

		await restoreDriverRide("d1");

		const state = useAcceptedRideStore.getState();
		expect(getUnfinishedRides).toHaveBeenCalledWith("d1", "driver");
		expect(state.acceptedRide.rideId).toBe("b");
		expect(state.acceptedRide.hasArrived).toBe(true);
		expect(state.nextRide.rideId).toBe("a");
		expect(state.isRideActive).toBe(true);
		expect(getRideCoordinates).not.toHaveBeenCalled();
	});

	it("looks up coordinates when the ride document has none", async () => {
		getUnfinishedRides.mockResolvedValue([
			{ rideId: "a", status: "accepted", pickupLocation: "Gate", destination: "Library" },
		]);
		getRideCoordinates.mockResolvedValue({ pickup: coords(6.8, 3.7), destination: coords(6.9, 3.8) });

		await restoreDriverRide("d1");
		await new Promise((r) => setImmediate(r));

		expect(getRideCoordinates).toHaveBeenCalledWith("Gate", "Library");
		expect(useAcceptedRideStore.getState().acceptedRide.pickupCoords).toEqual(coords(6.8, 3.7));
		expect(useAcceptedRideStore.getState().nextRide).toBeNull();
	});

	it("leaves an existing accepted ride alone", async () => {
		useAcceptedRideStore.getState().setAcceptedRide({ rideId: "live" });
		expect(await restoreDriverRide("d1")).toBeNull();
		expect(getUnfinishedRides).not.toHaveBeenCalled();
	});
});
