import {
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	PermissionsAndroid,
} from "react-native";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { colors } from "../../constants/styling";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import HomeTab from "../../components/DriversModal/HomeTab";
import HomeHeader from "../../components/DriverHeader/HomeHeader";
import { useBottomTabStore, useAcceptedRideStore } from "../../constants/Store";
import AcceptTab from "../../components/DriversModal/AcceptTab";
import AcceptHeader from "../../components/DriverHeader/AcceptHeader";
import { GOOGLE_MAPS_API_KEY } from "@env";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Geolocation from "@react-native-community/geolocation";
import { registerForPushNotificationsAsync } from "../../helpers/pushNotifications";
import { doc, updateDoc } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";
import { useDriverDetails } from "../../constants/Store";

const HomePage = () => {
	const Accept = useBottomTabStore((state) => state.AcceptRidePage);
	const ToHome = useBottomTabStore((state) => state.setHomePage);
	const acceptedRide = useAcceptedRideStore((state) => state.acceptedRide);
	const isRideActive = useAcceptedRideStore((state) => state.isRideActive);
	const navigation = useNavigation();
	const mapRef = useRef(null);
	const [mapReady, setMapReady] = useState(false);
	const { uid } = useDriverDetails((state) => ({ uid: state.uid }));

	// Request location permissions
	const requestLocationPermissions = async () => {
		try {
			const permission = await PermissionsAndroid.request(
				PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
				{
					title: "Location Permission",
					message: "This app needs access to your location to show your position on the map",
					buttonNeutral: "Ask Me Later",
					buttonNegative: "Cancel",
					buttonPositive: "OK",
				}
			);
			if (permission === PermissionsAndroid.RESULTS.GRANTED) {
				console.log("✅ Location permission granted");
				return true;
			} else {
				console.log("❌ Location permission denied");
				return false;
			}
		} catch (err) {
			console.warn("Error requesting location permission:", err);
			return false;
		}
	};

	// Request permissions on mount
	useEffect(() => {
		requestLocationPermissions();
	}, []);

	// Check if new driver and redirect to bank details
	useEffect(() => {
		const checkNewDriver = async () => {
			try {
				const isNewDriver = await AsyncStorage.getItem("isNewDriver");
				if (isNewDriver === "true") {
					await AsyncStorage.removeItem("isNewDriver");
					navigation.navigate("BankAccountDetails");
				}
			} catch (error) {
				console.error("Error checking new driver status:", error);
			}
		};
		checkNewDriver();
	}, []);

	// Register for push notifications
	useEffect(() => {
		const setupNotifications = async () => {
			if (!uid) return;

			try {
				console.log("📱 Registering driver for push notifications...");
				const token = await registerForPushNotificationsAsync();

				if (token) {
					console.log("✅ Driver FCM token obtained:", token.substring(0, 30) + "...");

					// Store token in Firestore
					const driverRef = doc(FIREBASE_DB, "drivers", uid);
					await updateDoc(driverRef, {
						fcmToken: token,
						lastTokenUpdate: new Date(),
					});
					console.log("✅ Driver FCM token saved to Firestore");
				} else {
					console.log("⚠️ Failed to get FCM token");
				}
			} catch (error) {
				console.error("❌ Error setting up notifications:", error);
			}
		};

		setupNotifications();
	}, [uid]);

	const BABCOCK_COORDINATES = {
		latitude: 6.8935,
		longitude: 3.723,
		latitudeDelta: 0.015,
		longitudeDelta: 0.015,
	};

	const HeaderComponents = useMemo(() => {
		if (Accept) {
			return <AcceptHeader />;
		} else {
			return <HomeHeader />;
		}
	}, [Accept]);

	const BottomSheetComponents = useMemo(() => {
		if (Accept) {
			return <AcceptTab />;
		} else {
			return <HomeTab />;
		}
	}, [Accept]);

	// Fit map once the map is ready and an active ride has coordinates
	useEffect(() => {
		if (!mapReady || !isRideActive || !mapRef.current) return;
		const p = acceptedRide?.pickupCoords;
		const d = acceptedRide?.destinationCoords;
		if (!p || !d) return;

		const pickupLat = parseFloat(p.latitude);
		const pickupLng = parseFloat(p.longitude);
		const destLat = parseFloat(d.latitude);
		const destLng = parseFloat(d.longitude);
		if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(destLat) || isNaN(destLng)) return;

		mapRef.current.fitToCoordinates(
			[{ latitude: pickupLat, longitude: pickupLng }, { latitude: destLat, longitude: destLng }],
			{ edgePadding: { top: 50, right: 20, bottom: 50, left: 20 }, animated: true }
		);
	}, [mapReady, isRideActive, acceptedRide]);

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
					onMapReady={() => setMapReady(true)}
				>
					{/* Route line - only visible when ride is active */}
					{isRideActive && acceptedRide?.pickupCoords && acceptedRide?.destinationCoords && (
						<MapViewDirections
							origin={{
								latitude: parseFloat(acceptedRide.pickupCoords.latitude),
								longitude: parseFloat(acceptedRide.pickupCoords.longitude)
							}}
							destination={{
								latitude: parseFloat(acceptedRide.destinationCoords.latitude),
								longitude: parseFloat(acceptedRide.destinationCoords.longitude)
							}}
							apikey={GOOGLE_MAPS_API_KEY || "AIzaSyCPMwyZl3iso7lmMGhQt0QwGJXWdqxcqiw"}
							strokeWidth={5}
							strokeColor="#007AFF"
							optimizeWaypoints={true}
							onReady={(result) => {
								console.log(`Distance: ${result.distance} km`);
								console.log(`Duration: ${result.duration} min.`);
							}}
							onError={(errorMessage) => {
								console.log('Directions error:', errorMessage);
							}}
						/>
					)}

					{/* Pickup marker - only visible when ride is active */}
					{isRideActive && acceptedRide?.pickupCoords && (
						<Marker
							coordinate={{
								latitude: parseFloat(acceptedRide.pickupCoords.latitude),
								longitude: parseFloat(acceptedRide.pickupCoords.longitude),
							}}
							title="Pickup Location"
							description={
								typeof acceptedRide.pickupLocation === 'object'
									? (acceptedRide.pickupLocation?.name || acceptedRide.pickupLocation?.address || "Pickup")
									: (acceptedRide.pickupLocation || "Pickup")
							}
							pinColor="#4caf50"
						/>
					)}

					{/* Destination marker - only visible when ride is active */}
					{isRideActive && acceptedRide?.destinationCoords && (
						<Marker
							coordinate={{
								latitude: parseFloat(acceptedRide.destinationCoords.latitude),
								longitude: parseFloat(acceptedRide.destinationCoords.longitude),
							}}
							title="Destination"
							description={
								typeof acceptedRide.destination === 'object'
									? (acceptedRide.destination?.name || acceptedRide.destination?.address || "Destination")
									: (acceptedRide.destination || "Destination")
							}
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

			{BottomSheetComponents}
		</View>
	);
};

export default HomePage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.lightGrey2,
	},
	map: {
		...StyleSheet.absoluteFillObject,
		height: "60%",
	},
	head: {
		zIndex: 999,
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
});
