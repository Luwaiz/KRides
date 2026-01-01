import { Button, PermissionsAndroid, StyleSheet, View, Text, Alert } from "react-native";
import React, { useEffect, useRef, useState, useMemo } from "react";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";
import ConfirmRide from "../../components/ConfirmRide";
import RideStatusBar from "../../components/RideStatusBar";
import RatingModal from "../../components/modals/RatingModal";
import HomeHeader from "../../components/homeHeader/HomeHeader";
import PassengerHeader from "../../components/homeHeader/PassengerHeader";
import ConfirmHeader from "../../components/homeHeader/ConfirmHeader";
import { useBottomTabStore, useActiveRideStore, useUserDetails, useRideStore } from "../../constants/Store";
import { GOOGLE_MAPS_API_KEY } from "@env";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Geolocation from "@react-native-community/geolocation";
import { useRideDetailsStore } from "../../constants/Store";
import { cancelRideWithRefund, listenToRide } from "../../helpers/firebaseRides";
import { notifyDriverRideCancelled } from "../../helpers/notificationHelpers";
import Toast from "react-native-toast-message";
import { registerForPushNotificationsAsync } from "../../helpers/pushNotifications";
import { doc, updateDoc } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";

const MainPage = () => {
	const [location, setLocation] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [showRatingModal, setShowRatingModal] = useState(false);
	const [completedRideData, setCompletedRideData] = useState(null);
	const pickup = useRideDetailsStore((s) => s.pickupLocation);
	const destination = useRideDetailsStore((s) => s.destination);
	const mapRef = useRef(null);

	const isPassengers = useBottomTabStore((state) => state.passengerPage);
	const confirm = useBottomTabStore((state) => state.confirmPage);
	const setConfirmPage = useBottomTabStore((state) => state.setConfirmPage);
	const setHomePage = useBottomTabStore((state) => state.setHomePage);

	// Active ride state
	const activeRide = useActiveRideStore(state => state.activeRide);
	const rideStatus = useActiveRideStore(state => state.rideStatus);
	const clearActiveRide = useActiveRideStore(state => state.clearActiveRide);
	const { firstName, lastName } = useUserDetails((state) => ({
		firstName: state.firstName,
		lastName: state.lastName,
	}));
	const UserId = useUserDetails((state) => state.UserId);

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
				console.error("❌ Error setting up notifications:", error);
			}
		};

		setupNotifications();
	}, [UserId]);

	// Listen for ride updates when there's an active ride
	useEffect(() => {
		if (!activeRide?.rideId) return;

		console.log('📡 MainPage - Setting up ride listener for:', activeRide.rideId);

		const unsubscribe = listenToRide(activeRide.rideId, (rideData) => {
			if (rideData) {
				console.log('🔥 MainPage - Ride update received:', {
					status: rideData.status,
					driverName: rideData.driverName,
				});

				// Update active ride store status
				useActiveRideStore.getState().updateRideStatus(rideData.status);

				// If driver accepts ride
				if (rideData.status === "accepted" && rideData.driverName) {
					console.log('✅ MainPage - Driver accepted, updating driver info');
					console.log('   Driver data from Firestore:', {
						driverName: rideData.driverName,
						driverId: rideData.driverId,
						driverPhone: rideData.driverPhone,
						vehicleId: rideData.vehicleId
					});
					useActiveRideStore.getState().updateDriverInfo(
						rideData.driverName,
						rideData.driverId,
						rideData.driverPhone,
						rideData.vehicleId
					);

					// Log the updated state
					const updatedRide = useActiveRideStore.getState().activeRide;
					console.log('   Updated activeRide:', {
						driverName: updatedRide?.driverName,
						driverPhone: updatedRide?.driverPhone,
						vehicleId: updatedRide?.vehicleId
					});
				}

				// Check if driver has arrived
				if (rideData.hasArrived !== undefined) {
					console.log('🚗 MainPage - Driver arrival status:', rideData.hasArrived);
					useActiveRideStore.getState().updateArrivalStatus(rideData.hasArrived);
				}

				// If ride is completed - show rating modal
				if (rideData.status === "completed" && !rideData.customerRating) {
					console.log('✅ MainPage - Ride completed, showing rating modal');

					// Reset bottom tab navigation state FIRST
					setHomePage();

					setCompletedRideData({
						rideId: activeRide.rideId,
						driverId: rideData.driverId || activeRide.driverId,
						driverName: rideData.driverName || activeRide.driverName || 'Driver',
					});
					setShowRatingModal(true);
					clearActiveRide();

					// Reset location selections for fresh start
					useRideStore.getState().clearRide();
					useRideDetailsStore.getState().resetRideDetails();
				}

				// If ride is cancelled
				if (rideData.status === "cancelled") {
					console.log('❌ MainPage - Ride cancelled, clearing active ride and resetting selections');

					// Reset bottom tab navigation state
					setHomePage();

					clearActiveRide();

					// Reset location selections for fresh start
					useRideStore.getState().clearRide();
					useRideDetailsStore.getState().resetRideDetails();
				}
			}
		});

		return () => {
			console.log('🔌 MainPage - Unsubscribing from ride listener');
			unsubscribe();
		};
	}, [activeRide?.rideId]);

	// Debug: Log active ride state changes
	useEffect(() => {
		console.log('🏠 MainPage - Active Ride State:', {
			hasActiveRide: !!activeRide,
			rideId: activeRide?.rideId,
			status: rideStatus,
			driverName: activeRide?.driverName,
		});
	}, [activeRide, rideStatus]);

	// Debug: Log pickup and destination from store
	useEffect(() => {
		console.log('🗺️ MainPage store values:', {
			pickup: pickup,
			destination: destination,
			hasPickup: !!pickup,
			hasDestination: !!destination
		});
	}, [pickup, destination]);

	// Fit map to show route when pickup and destination are set
	useEffect(() => {
		if (pickup && destination && mapRef.current) {
			try {
				const pickupCoords = pickup.coord || pickup;
				const destCoords = destination.coord || destination;

				// Validate coordinates exist
				if (!pickupCoords.latitude || !destCoords.latitude) {
					console.error("❌ Missing coordinates:", { pickup: pickupCoords, destination: destCoords });
					return;
				}

				// Parse and validate coordinates
				const pickupLat = parseFloat(pickupCoords.latitude);
				const pickupLng = parseFloat(pickupCoords.longitude);
				const destLat = parseFloat(destCoords.latitude);
				const destLng = parseFloat(destCoords.longitude);

				// Check if coordinates are valid numbers
				if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(destLat) || isNaN(destLng)) {
					console.error("❌ Invalid coordinates:", {
						pickup: pickupCoords,
						destination: destCoords
					});
					return;
				}

				console.log("📍 Fitting map to coordinates:", {
					pickup: { lat: pickupLat, lng: pickupLng },
					destination: { lat: destLat, lng: destLng }
				});

				// Add a small delay to ensure map is fully rendered
				setTimeout(() => {
					if (mapRef.current) {
						mapRef.current.fitToCoordinates(
							[
								{ latitude: pickupLat, longitude: pickupLng },
								{ latitude: destLat, longitude: destLng }
							],
							{
								edgePadding: { top: 50, right: 20, bottom: 50, left: 20 },
								animated: true,
							}
						);
					}
				}, 500);
			} catch (error) {
				console.error("❌ Error fitting map to coordinates:", error);
			}
		}
	}, [pickup, destination]);

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
								Toast.show({
									type: 'tomatoToast',
									text1: 'Ride Cancelled & Refunded',
									text2: `₦${result.refundAmount} will be refunded`,
									position: 'top',
									visibilityTime: 4000,
								});
							} else {
								Toast.show({
									type: 'tomatoToast',
									text1: 'Ride Cancelled',
									text2: 'Your ride has been cancelled',
									position: 'top',
									visibilityTime: 3000,
								});
							}
						} catch (error) {
							console.error('Error cancelling ride:', error);
							Toast.show({
								type: 'error',
								text1: 'Error',
								text2: 'Unable to cancel ride',
								position: 'top',
							});
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
			if (confirm) {
				return <ConfirmHeader />;
			} else {
				return <PassengerHeader />;
			}
		} else {
			return <HomeHeader />;
		}
	}, [isPassengers, confirm]);

	const BottomSheetComponents = useMemo(() => {
		if (isPassengers) {
			if (confirm) {
				return <ConfirmRide />;
			} else {
				return <Passenger />;
			}
		} else {
			return <HomeTab />;
		}
	}, [isPassengers, confirm]);

	return (
		<View style={styles.container}>
			<View style={styles.head}>{HeaderComponents}</View>
			{/* Map is always visible */}
			{GOOGLE_MAPS_API_KEY || true ? (
				<MapView
					ref={mapRef}
					provider={PROVIDER_GOOGLE}
					style={styles.map}
					initialRegion={BABCOCK_COORDINATES}
					showsUserLocation={true}
					showsMyLocationButton={true}
					showsCompass={true}
					loadingEnabled={true}
				>
					{/* Route line - only visible when ride is active */}
					{pickup && destination && (() => {
						const pickupCoords = pickup.coord || pickup;
						const destCoords = destination.coord || destination;

						return (
							<MapViewDirections
								origin={{
									latitude: parseFloat(pickupCoords.latitude),
									longitude: parseFloat(pickupCoords.longitude)
								}}
								destination={{
									latitude: parseFloat(destCoords.latitude),
									longitude: parseFloat(destCoords.longitude)
								}}
								apikey={GOOGLE_MAPS_API_KEY || "AIzaSyCPMwyZl3iso7lmMGhQt0QwGJXWdqxcqiw"}
								strokeWidth={5}
								strokeColor="#007AFF"
								optimizeWaypoints={true}
								onReady={(result) => {
									console.log('✅ Route loaded successfully!');
									console.log(`   Distance: ${result.distance} km`);
									console.log(`   Duration: ${result.duration} min.`);
								}}
								onError={(errorMessage) => {
									console.error('❌ MapViewDirections error:', errorMessage);
								}}
							/>
						);
					})()}

					{/* Pickup marker - only visible when ride is active */}
					{pickup && (
						<Marker
							coordinate={{
								latitude: parseFloat((pickup.coord || pickup).latitude),
								longitude: parseFloat((pickup.coord || pickup).longitude)
							}}
							title="Pickup Location"
							description={pickup.name || "Pickup"}
							pinColor="#4caf50"
						/>
					)}

					{/* Destination marker - only visible when ride is active */}
					{destination && (
						<Marker
							coordinate={{
								latitude: parseFloat((destination.coord || destination).latitude),
								longitude: parseFloat((destination.coord || destination).longitude)
							}}
							title="Destination"
							description={destination.name || "Destination"}
							pinColor="#1976D2"
						/>
					)}
				</MapView>
			) : (
				<View
					style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
				>
					<Text>Map loading or configuration error...</Text>
				</View>
			)}

			{/* Ride Status Bar - shown when ride is active */}
			{activeRide && (
				<RideStatusBar
					status={rideStatus}
					driverName={activeRide.driverName}
					driverPhone={activeRide.driverPhone}
					vehicleId={activeRide.vehicleId}
					hasArrived={activeRide.hasArrived}
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
