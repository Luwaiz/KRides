import { getUnfinishedRides } from "./firebaseRides";
import { getRideCoordinates } from "./getLocationCoordinates";
import {
	useActiveRideStore,
	useAcceptedRideStore,
	useRideDetailsStore,
} from "../constants/Store";

// The current ride lives only in memory, so a restart (the user swiping the app away, or
// iOS closing it in the background) would otherwise lose it. These look the ride up again
// and put it back in the store; the screens' existing listeners take over from there.

const validCoords = (c) =>
	c && Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))
		? { latitude: Number(c.latitude), longitude: Number(c.longitude) }
		: null;

// Returns the restored ride, or null if there was nothing to restore.
export async function restoreCustomerRide(uid) {
	if (!uid || useActiveRideStore.getState().activeRide) return null;

	const rides = await getUnfinishedRides(uid, "customer");
	// Newest is the one the customer is most likely waiting on.
	const ride = rides[rides.length - 1];
	if (!ride || useActiveRideStore.getState().activeRide) return null;

	useActiveRideStore.getState().setActiveRide({
		rideId: ride.rideId,
		status: ride.status,
		driverName: ride.driverName || null,
		driverId: ride.driverId || null,
		driverPhone: ride.driverPhone || null,
		vehicleId: ride.vehicleId || null,
		hasArrived: !!ride.hasArrived,
		pickupLocation: ride.pickupLocation,
		destination: ride.destination,
		amount: ride.amount,
	});

	const details = useRideDetailsStore.getState();
	const pickup = validCoords(ride.pickupCoords);
	const dest = validCoords(ride.destinationCoords);
	if (pickup && !details.pickupLocation) {
		details.setPickupLocation({ name: ride.pickupLocation, ...pickup });
	}
	if (dest && !details.destination) {
		details.setDestination({ name: ride.destination, ...dest });
	}

	return ride;
}

const toAcceptedRide = (ride) => ({
	...ride,
	pickupCoords: validCoords(ride.pickupCoords),
	destinationCoords: validCoords(ride.destinationCoords),
});

// Returns the restored ride, or null if there was nothing to restore.
export async function restoreDriverRide(uid) {
	const store = useAcceptedRideStore;
	if (!uid || store.getState().acceptedRide) return null;

	const rides = await getUnfinishedRides(uid, "driver");
	if (!rides.length || store.getState().acceptedRide) return null;

	// A driver can hold one current ride plus one queued ride. The current one is the
	// ride already under way, otherwise the one accepted first.
	const current = rides.find((r) => r.status === "in_progress") || rides[0];
	const queued = rides.find((r) => r.rideId !== current.rideId) || null;

	store.getState().setAcceptedRide(toAcceptedRide(current));
	if (queued) store.getState().setNextRide(toAcceptedRide(queued));

	if (!validCoords(current.pickupCoords) || !validCoords(current.destinationCoords)) {
		getRideCoordinates(current.pickupLocation, current.destination)
			.then(({ pickup, destination }) => {
				if (store.getState().acceptedRide?.rideId === current.rideId) {
					store.getState().updateRideCoords(pickup, destination);
				}
			})
			.catch((err) => console.warn("⚠️ Could not load coordinates for restored ride:", err.message));
	}

	return current;
}
