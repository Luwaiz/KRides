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
		}),
}));

export const useDriverDetails = create((set) => ({
	fullName: "",
	phone: "",
	email: "",
	vehicle_id: "",
	uid: "",
	accessToken: "",
	isOnline: false,
	rating: 0,
	totalRides: 0,
	profileImageUrl: null,
	createdAt: null,
	// Actions
	setDriverProfile: (profile) =>
		set({
			fullName: profile.name || profile.fullName || profile.fullname || "",
			phone: profile.phone,
			email: profile.email,
			vehicle_id: profile.vehicle_id,
			uid: profile.uid,
			accessToken: profile.accessToken || "",
			isOnline: profile.isOnline || false,
			rating: profile.rating || 0,
			totalRides: profile.totalRides || 0,
			profileImageUrl: profile.profileImageUrl,
			createdAt: profile.createdAt,
		}),
	setFullName: (fullName) => set({ fullName }),
	setPhone: (phone) => set({ phone }),
	setEmail: (email) => set({ email }),
	setVehicleId: (vehicle_id) => set({ vehicle_id }),
	setAccessToken: (accessToken) => set({ accessToken }),
	setIsOnline: (isOnline) => set({ isOnline }),
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
			isOnline: false,
			rating: 0,
			totalRides: 0,
			profileImageUrl: null,
			createdAt: null,
		}),
	clearDriver: () =>
		set({
			fullName: "",
			phone: "",
			email: "",
			vehicle_id: "",
			uid: "",
			accessToken: "",
			isOnline: false,
			rating: 0,
			totalRides: 0,
			profileImageUrl: null,
			createdAt: null,
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
	acceptedRide: null, // Full ride object with coordinates
	isRideActive: false,
	setAcceptedRide: (ride) => set({ acceptedRide: ride, isRideActive: true }),
	clearAcceptedRide: () => set({ acceptedRide: null, isRideActive: false }),
}));
