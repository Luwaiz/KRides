import { PermissionsAndroid, StyleSheet, View, Alert } from "react-native";
import React, { useEffect, useRef, useState, useMemo } from "react";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";
import ConfirmRide from "../../components/ConfirmRide";
import RideStatusBar from "../../components/RideStatusBar";
import RatingModal from "../../components/modals/RatingModal";
import HomeHeader from "../../components/homeHeader/HomeHeader";
import PassengerHeader from "../../components/homeHeader/PassengerHeader";
import ConfirmHeader from "../../components/homeHeader/ConfirmHeader";
import { useBottomTabStore, useActiveRideStore, useUserDetails, useRideStore, useRideDetailsStore } from "../../constants/Store";
import { GOOGLE_MAPS_API_KEY } from "@env";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Geolocation from "@react-native-community/geolocation";
import { useShallow } from "zustand/react/shallow";
import { cancelRideWithRefund, listenToRide } from "../../helpers/firebaseRides";
import { notifyDriverRideCancelled } from "../../helpers/notificationHelpers";
import Toast from "react-native-toast-message";
import { registerForPushNotificationsAsync } from "../../helpers/pushNotifications";
import { doc, updateDoc } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";

const MainPage = () => {
	const [location, setLocation] = useState(false);
	const [mapReady, setMapReady] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [showRatingModal, setShowRatingModal] = useState(false);
	const [completedRideData, setCompletedRideData] = useState(null);
	const mapRef = useRef(null);

	// Consolidated store subscriptions — one subscription per store
	const { isPassengers, confirm, setConfirmPage, setHomePage } = useBottomTabStore(
		useShallow((state) => ({
			isPassengers: state.passengerPage,
			confirm: state.confirmPage,
			setConfirmPage: state.setConfirmPage,
			setHomePage: state.setHomePage,
		}))
	);

	const { activeRide, rideStatus, clearActiveRide } = useActiveRideStore(
		useShallow((state) => ({
			activeRide: state.activeRide,
			rideStatus: state.rideStatus,
			clearActiveRide: state.clearActiveRide,
		}))
	);

	const { firstName, lastName, UserId } = useUserDetails(
		useShallow((state) => ({
			firstName: state.firstName,
			lastName: state.lastName,
			UserId: state.UserId,
		}))
	);

	const { pickup, destination } = useRideDetailsStore(
		useShallow((state) => ({ pickup: state.pickupLocation, destination: state.destination }))
	);

	// Stable coordinate objects — prevent MapViewDirections from re-fetching on unrelated renders
	const pickupCoords = useMemo(() => {
		if (!pickup) return null;
		const p = pickup.coord || pickup;
		const lat = parseFloat(p.latitude);
		const lng = parseFloat(p.longitude);
		return isNaN(lat) || isNaN(lng) ? null : { latitude: lat, longitude: lng };
	}, [pickup]);

	const destCoords = useMemo(() => {
		if (!destination) return null;
		const d = destination.coord || destination;
		const lat = parseFloat(d.latitude);
		const lng = parseFloat(d.longitude);
		return isNaN(lat) || isNaN(lng) ? null : { latitude: lat, longitude: lng };
	}, [destination]);

	const BABCOCK_COORDINATES = (location && location.coords)
		? {
			latitude: location.coords.latitude,
			longitude: location.coords.longitude,
			latitudeDelta: 0.01,
			longitudeDelta: 0.01,
		}
		: {
			latitude: 6.8935, // Babcock's central latitude
			longitude: 3.723, // Babcock's central longitude
			latitudeDelta: 0.01,
			longitudeDelta: 0.01,
		};

	const requestLocationPermissions = async () => {
		try {
			const permission = await PermissionsAndroid.request(
				PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
				{
					title: "Location Permissions",
					message: "Permission to access your location is required",
					buttonNeutral: "Ask me later",
					buttonNegative: "Cancel",
					buttonPositive: "OK",
				}
			);
			console.log(permission);
			if (permission === "granted") {
				return true;
			} else {
				return false;
			}
		} catch (e) { }
	};

	const getLocationN = async () => {
		const response = await requestLocationPermissions();
		try {
			if (response) {
				Geolocation.getCurrentPosition(
					(position) => {
						setLocation(position);
					},
					(error) => {
						setLocation(false);
					},
					{ enableHighAccuracy: false, timeout: 15000 }
				);
			} else {
			}
		} catch (error) { }
	};

	useEffect(() => {
		getLocationN();
	}, []);

	// Register for push notifications
	useEffect(() => {
		const setupNotifications = async () => {
			if (!UserId) return;

			try {
				console.log("📱 Registering customer for push notifications...");
				const token = await registerForPushNotificationsAsync();

				if (token) {
					console.log("✅ Customer FCM token obtained:", token.substring(0, 30) + "...");

					// Store token in Firestore
					const userRef = doc(FIREBASE_DB, "users", UserId);
					await updateDoc(userRef, {
						fcmToken: token,
						lastTokenUpdate: new Date(),
					});
					console.log("✅ Customer FCM token saved to Firestore");
				} else {
					console.log("⚠️ Failed to get FCM token");
				}
			} catch (error) {
				console.warn("⚠️ Error setting up notifications (non-critical):", error);
			}
		};

		setupNotifications();
	}, [UserId]);

	// Listen for ride updates when there's an active ride
	useEffect(() => {
		if (!activeRide?.rideId) return;

		const unsubscribe = listenToRide(activeRide.rideId, (rideData) => {
			if (rideData) {
				// Update active ride store status
				useActiveRideStore.getState().updateRideStatus(rideData.status);

				// If driver accepts ride
				if (rideData.status === "accepted" && rideData.driverName) {
					useActiveRideStore.getState().updateDriverInfo(
						rideData.driverName,
						rideData.driverId,
						rideData.driverPhone,
						rideData.vehicleId
					);
				}

				// Check if driver has arrived
				if (rideData.hasArrived !== undefined) {
					useActiveRideStore.getState().updateArrivalStatus(rideData.hasArrived);
				}

				// If ride is completed - show rating modal
				if (rideData.status === "completed" && !rideData.customerRating) {
					setHomePage();
					setCompletedRideData({
						rideId: activeRide.rideId,
						driverId: rideData.driverId || activeRide.driverId,
						driverName: rideData.driverName || activeRide.driverName || 'Driver',
						pickupLocation: rideData.pickupLocation || activeRide.pickupLocation,
						destination: rideData.destination || activeRide.destination,
						amount: rideData.amount || activeRide.amount,
						completedAt: rideData.completedAt || null,
					});
					setShowRatingModal(true);
					clearActiveRide();
					useRideStore.getState().clearRide();
					useRideDetailsStore.getState().resetRideDetails();
				}

				// If ride is cancelled
				if (rideData.status === "cancelled") {
					setHomePage();
					clearActiveRide();
					useRideStore.getState().clearRide();
					useRideDetailsStore.getState().resetRideDetails();
					const cancelledByDriver = rideData.cancelledBy === 'driver';
					Toast.show({
						type: 'tomatoToast',
						text1: 'Ride Cancelled',
						text2: cancelledByDriver
							? 'Your driver cancelled the ride. Please book a new one.'
							: 'Your ride has been cancelled.',
						position: 'top',
						visibilityTime: 4000,
					});
				}
			}
		});

		return () => unsubscribe();
	}, [activeRide?.rideId]);

	// Fit map once the map is ready and coordinates are available
	useEffect(() => {
		if (mapReady && pickupCoords && destCoords && mapRef.current) {
			mapRef.current.fitToCoordinates(
				[pickupCoords, destCoords],
				{ edgePadding: { top: 50, right: 20, bottom: 50, left: 20 }, animated: true }
			);
		}
	}, [mapReady, pickupCoords, destCoords]);

	// Handle cancel ride from status bar
	const handleCancelRide = async () => {
		if (!activeRide) return;

		Alert.alert(
			"Cancel Ride",
			rideStatus === "accepted"
				? "A driver has already accepted your ride. Are you sure you want to cancel?"
				: "Are you sure you want to cancel this ride?",
			[
				{ text: "No, Keep Ride", style: "cancel" },
				{
					text: "Yes, Cancel",
					style: "destructive",
					onPress: async () => {
						setCancelling(true);
						try {
							const result = await cancelRideWithRefund(
								activeRide.rideId,
								'customer',
								'Customer cancelled the ride'
							);

							// Notify driver if ride was accepted
							if (rideStatus === "accepted" && activeRide.driverId) {
								await notifyDriverRideCancelled(
									activeRide.driverId,
									activeRide.rideId,
									`${firstName} ${lastName}`
								);
							}

							clearActiveRide();

							if (result.refundStatus === "completed") {
								const wasAccepted = rideStatus === "accepted";
								Toast.show({
									type: 'tomatoToast',
									text1: 'Ride Cancelled & Refunded',
									text2: wasAccepted
										? `₦${result.refundAmount} refund initiated — allow 3–5 business days`
										: `Full refund of ₦${result.refundAmount} initiated — allow 3–5 business days`,
									position: 'top',
									visibilityTime: 5000,
								});
							} else {
								Toast.show({
									type: 'tomatoToast',
									text1: 'Ride Cancelled',
									text2: 'Your ride has been cancelled. Any payment will be reviewed for refund.',
									position: 'top',
									visibilityTime: 4000,
								});
							}
						} catch (error) {
							console.error('Error cancelling ride:', error);
						} finally {
							setCancelling(false);
						}
					}
				}
			]
		);
	};

	// Handle view details from status bar
	const handleViewDetails = () => {
		setConfirmPage();
	};

	const HeaderComponents = useMemo(() => {
		if (isPassengers) {
			return confirm ? <ConfirmHeader /> : <PassengerHeader />;
		}
		return <HomeHeader />;
	}, [isPassengers, confirm]);

	const BottomSheetComponents = useMemo(() => {
		if (isPassengers) {
			return confirm ? <ConfirmRide /> : <Passenger />;
		}
		return <HomeTab />;
	}, [isPassengers, confirm]);

	return (
		<View style={styles.container}>
			<View style={styles.head}>{HeaderComponents}</View>

			<MapView
				ref={mapRef}
				provider={PROVIDER_GOOGLE}
				style={styles.map}
				initialRegion={BABCOCK_COORDINATES}
				showsUserLocation={true}
				showsMyLocationButton={true}
				showsCompass={true}
				loadingEnabled={true}
				onMapReady={() => setMapReady(true)}
			>
				{pickupCoords && destCoords && (
					<MapViewDirections
						origin={pickupCoords}
						destination={destCoords}
						apikey={GOOGLE_MAPS_API_KEY}
						strokeWidth={5}
						strokeColor="#007AFF"
						optimizeWaypoints={true}
						onError={() => {}}
					/>
				)}

				{pickupCoords && (
					<Marker
						coordinate={pickupCoords}
						title="Pickup Location"
						description={pickup.name || "Pickup"}
						pinColor="#4caf50"
					/>
				)}

				{destCoords && (
					<Marker
						coordinate={destCoords}
						title="Destination"
						description={destination.name || "Destination"}
						pinColor="#1976D2"
					/>
				)}
			</MapView>

			{/* Ride Status Bar - shown when ride is active */}
			{activeRide && (
				<RideStatusBar
					status={rideStatus}
					driverName={activeRide.driverName}
					driverPhone={activeRide.driverPhone}
					vehicleId={activeRide.vehicleId}
					onCancel={handleCancelRide}
					onViewDetails={handleViewDetails}
					cancelling={cancelling}
				/>
			)}

			{/* Bottom Sheet */}
			{BottomSheetComponents}

			{/* Rating Modal - shown after ride completion */}
			{showRatingModal && completedRideData && (
				<RatingModal
					visible={showRatingModal}
					onClose={() => {
						setShowRatingModal(false);
						setCompletedRideData(null);
						setHomePage(); // Navigate back to home after rating
					}}
					rideId={completedRideData.rideId}
					driverId={completedRideData.driverId}
					driverName={completedRideData.driverName}
					pickupLocation={completedRideData.pickupLocation}
					destination={completedRideData.destination}
					amount={completedRideData.amount}
					completedAt={completedRideData.completedAt}
				/>
			)}
		</View>
	);
};


export default MainPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	map: {
		...StyleSheet.absoluteFillObject,
		height: "60%",
	},
	head: {
		flex: 0.1,
		zIndex: 999,
	},
});
