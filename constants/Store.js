import { create } from "zustand";

export const useBottomTabStore = create((set) => ({
	passengerPage: false,
	confirmPage: false,
	AcceptRidePage: false,
	PassengerPage: () =>
		set((state) => ({ passengerPage: !state.passengerPage })),
	setConfirmPage: () => set((state) => ({ confirmPage: !state.confirmPage })),
	setAcceptRidePage: () =>
		set((state) => ({ AcceptRidePage: !state.AcceptRidePage })),
	setDriverHome: () => set({ AcceptRidePage: false }),
	setHomePage: () => set({ passengerPage: false, confirmPage: false }),
}));

export const useUserDetails = create((set) => ({
	firstName: "",
	lastName: "",
	phone: "",
	email: "",
	password: "",
	UserId: "",
	accessToken: "",
	profileImageUrl: null,
	setAccessToken: (accessToken) => set({ accessToken }),
	setFirstName: (firstName) => set({ firstName }),
	setLastName: (lastName) => set({ lastName }),
	setPhone: (phone) => set({ phone }),
	setEmail: (email) => set({ email }),
	setPassword: (password) => set({ password }),
	setUserId: (UserId) => set({ UserId }),
	clearUser: () =>
		set({
			firstName: "",
			lastName: "",
			phone: "",
			email: "",
			password: "",
			UserId: "",
			accessToken: "",
			profileImageUrl: null,
		}),
	setProfileImageUrl: (url) => set({ profileImageUrl: url }),
}));

export const useDriverDetails = create((set) => ({
	fullName: "",
	phone: "",
	email: "",
	vehicle_id: "",
	uid: "",
	accessToken: "",
	rating: 0,
	totalRides: 0,
	profileImageUrl: null,
	createdAt: null,
	bankName: "",
	accountNumber: "",
	accountName: "",
	bankDetailsVerified: false,
	// Actions
	setDriverProfile: (profile) =>
		set({
			fullName: profile.name || profile.fullName || profile.fullname || "",
			phone: profile.phone,
			email: profile.email,
			vehicle_id: profile.vehicle_id,
			uid: profile.uid,
			accessToken: profile.accessToken || "",
			rating: profile.rating || 0,
			totalRides: profile.totalRides || 0,
			profileImageUrl: profile.profileImageUrl,
			createdAt: profile.createdAt,
			bankName: profile.bankName || "",
			accountNumber: profile.accountNumber || "",
			accountName: profile.accountName || "",
			bankDetailsVerified: profile.bankDetailsVerified || false,
		}),
	setFullName: (fullName) => set({ fullName }),
	setPhone: (phone) => set({ phone }),
	setEmail: (email) => set({ email }),
	setVehicleId: (vehicle_id) => set({ vehicle_id }),
	setAccessToken: (accessToken) => set({ accessToken }),
	setRating: (rating) => set({ rating }),
	setTotalRides: (totalRides) => set({ totalRides }),
	setProfileImageUrl: (url) => set({ profileImageUrl: url }),
	clearDriverProfile: () =>
		set({
			fullName: "",
			phone: "",
			email: "",
			vehicle_id: "",
			uid: "",
			accessToken: "",
			rating: 0,
			totalRides: 0,
			profileImageUrl: null,
			createdAt: null,
			bankName: "",
			accountNumber: "",
			accountName: "",
			bankDetailsVerified: false,
		}),
	clearDriver: () =>
		set({
			fullName: "",
			phone: "",
			email: "",
			vehicle_id: "",
			uid: "",
			accessToken: "",
			rating: 0,
			totalRides: 0,
			profileImageUrl: null,
			createdAt: null,
			bankName: "",
			accountNumber: "",
			accountName: "",
			bankDetailsVerified: false,
		}),
}));

// Auth store for user/driver profile and role
const useAuthStore = create((set) => ({
	user: null,
	profile: null,
	role: null,
	setAuthData: (user, profile, role) => set({ user, profile, role }),
	clearAuth: () => set({ user: null, profile: null, role: null }),
}));

export default useAuthStore;

export const useRideStore = create((set) => ({
	rideId: "",
	numberOfPassenger: "",
	destination: "",
	location: "",
	price: "",
	rider: "",
	setRideId: (rideId) => set({ rideId }),
	setNumberOfPassenger: (numberOfPassenger) => set({ numberOfPassenger }),
	setDestination: (destination) => set({ destination }),
	setLocation: (location) => set({ location }),
	setPrice: (price) => set({ price }),
	setRider: (rider) => set({ rider }),
}));

export const useRideDetailsStore = create((set) => ({
	pickupLocation: null, // { latitude, longitude, name }
	destination: null, // { latitude, longitude, name }
	numPassengers: 1,
	selectedDriver: null, // Driver object
	rideCost: 0,
	paymentMethod: null,
	// Actions to update the state
	setPickupLocation: (location) => set({ pickupLocation: location }),
	setDestination: (location) => set({ destination: location }),
	setNumPassengers: (count) => set({ numPassengers: count }),
	setSelectedDriver: (driver) => set({ selectedDriver: driver }),
	setRideCost: (cost) => set({ rideCost: cost }),
	setPaymentMethod: (method) => set({ paymentMethod: method }),
	resetRideDetails: () =>
		set({
			pickupLocation: null,
			destination: null,
			numPassengers: 1,
			selectedDriver: null,
			rideCost: 0,
			paymentMethod: null,
		}),
}));

// Store for driver's accepted ride details
export const useAcceptedRideStore = create((set) => ({
	acceptedRide: null, // Current active ride
	nextRide: null, // Next queued ride
	isRideActive: false,
	setAcceptedRide: (ride) => set({ acceptedRide: ride, isRideActive: true }),
	setNextRide: (ride) => set({ nextRide: ride }),
	clearAcceptedRide: () => set({ acceptedRide: null, isRideActive: false }),
	clearNextRide: () => set({ nextRide: null }),
	// Move next ride to active when current ride completes
	activateNextRide: () => set((state) => {
		console.log('🔄 activateNextRide called in Store');
		console.log('   Current state:', {
			hasAcceptedRide: !!state.acceptedRide,
			acceptedRideId: state.acceptedRide?.rideId,
			hasNextRide: !!state.nextRide,
			nextRideId: state.nextRide?.rideId,
			isRideActive: state.isRideActive
		});

		const newState = {
			acceptedRide: state.nextRide,
			nextRide: null,
			isRideActive: !!state.nextRide,
		};

		console.log('   New state will be:', {
			hasAcceptedRide: !!newState.acceptedRide,
			acceptedRideId: newState.acceptedRide?.rideId,
			hasNextRide: !!newState.nextRide,
			isRideActive: newState.isRideActive
		});

		return newState;
	}),
}));

// Store for customer's active ride (for status bar)
export const useActiveRideStore = create((set) => ({
	activeRide: null,
	rideStatus: null,

	setActiveRide: (rideData) => set({
		activeRide: rideData,
		rideStatus: rideData.status
	}),

	updateRideStatus: (status) => set({ rideStatus: status }),

	updateDriverInfo: (driverName, driverId, driverPhone, vehicleId) => set((state) => ({
		activeRide: state.activeRide ? {
			...state.activeRide,
			driverName,
			driverId,
			driverPhone,
			vehicleId,
		} : null
	})),

	updateArrivalStatus: (hasArrived) => set((state) => ({
		activeRide: state.activeRide ? {
			...state.activeRide,
			hasArrived,
		} : null
	})),

	clearActiveRide: () => set({
		activeRide: null,
		rideStatus: null
	}),
}));

// Store for driver availability (online/offline status)
export const useDriverAvailability = create((set) => ({
	isOnline: true,
	setOnline: () => set({ isOnline: true }),
	setOffline: () => set({ isOnline: false }),
	toggleAvailability: () => set((state) => ({ isOnline: !state.isOnline })),
}));
