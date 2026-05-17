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
import { useAcceptedRideStore } from "../../constants/Store";
import AcceptTab from "../../components/DriversModal/AcceptTab";
import AcceptHeader from "../../components/DriverHeader/AcceptHeader";
import { GOOGLE_MAPS_API_KEY } from "@env";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Geolocation from "@react-native-community/geolocation";
import { registerForPushNotificationsAsync } from "../../helpers/pushNotifications";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";
import { useDriverDetails } from "../../constants/Store";

const HomePage = () => {
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

	// Register for push notifications
	useEffect(() => {
		const setupNotifications = async () => {
			if (!uid) return;

			try {
				console.log("📱 Registering driver for push notifications...");
				const token = await registerForPushNotificationsAsync();

				if (token) {
					console.log("✅ Driver FCM token obtained:", token.substring(0, 30) + "...");

					const driverRef = doc(FIREBASE_DB, "drivers", uid);
					const snap = await getDoc(driverRef);
					if (snap.exists() && snap.data()?.fcmToken === token) {
						console.log("✅ Driver FCM token unchanged, skipping write");
					} else {
						await updateDoc(driverRef, {
							fcmToken: token,
							lastTokenUpdate: new Date(),
						});
						console.log("✅ Driver FCM token saved to Firestore");
					}
				} else {
					console.warn("⚠️ Failed to get FCM token");
					// Non-critical: driver still works, just won't get push notifications
				}
			} catch (error) {
				console.error("❌ Error setting up notifications:", error);
			}
		};

		setupNotifications();
	}, [uid]);

	// Validated, stable coordinate objects — prevent NaN from reaching the map
	// when acceptedRide coords are missing or malformed.
	const pickupCoords = useMemo(() => {
		const p = acceptedRide?.pickupCoords;
		if (!p) return null;
		const lat = parseFloat(p.latitude);
		const lng = parseFloat(p.longitude);
		if (isNaN(lat) || isNaN(lng) || lat < 2 || lat > 14 || lng < 3 || lng > 15) return null;
		return { latitude: lat, longitude: lng };
	}, [acceptedRide?.pickupCoords]);

	const destCoords = useMemo(() => {
		const d = acceptedRide?.destinationCoords;
		if (!d) return null;
		const lat = parseFloat(d.latitude);
		const lng = parseFloat(d.longitude);
		if (isNaN(lat) || isNaN(lng) || lat < 2 || lat > 14 || lng < 3 || lng > 15) return null;
		return { latitude: lat, longitude: lng };
	}, [acceptedRide?.destinationCoords]);

	const BABCOCK_COORDINATES = {
		latitude: 6.8935,
		longitude: 3.723,
		latitudeDelta: 0.015,
		longitudeDelta: 0.015,
	};

	// Use acceptedRide as the single source of truth — the AcceptRidePage flag in
	// useBottomTabStore is never reset on ride completion, so relying on it caused
	// the screen to stay stuck on AcceptTab after a ride ended.
	const HeaderComponents = useMemo(() => {
		return acceptedRide ? <AcceptHeader /> : <HomeHeader />;
	}, [acceptedRide]);

	const BottomSheetComponents = useMemo(() => {
		return acceptedRide ? <AcceptTab /> : <HomeTab />;
	}, [acceptedRide]);

	// Fit map once the map is ready and valid ride coordinates are available
	useEffect(() => {
		if (!mapReady || !isRideActive || !mapRef.current || !pickupCoords || !destCoords) return;
		mapRef.current.fitToCoordinates(
			[pickupCoords, destCoords],
			{ edgePadding: { top: 50, right: 20, bottom: 50, left: 20 }, animated: true }
		);
	}, [mapReady, isRideActive, pickupCoords, destCoords]);

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
					{/* Route line — only rendered when both coords are valid */}
					{isRideActive && pickupCoords && destCoords && (
						<MapViewDirections
							origin={pickupCoords}
							destination={destCoords}
							apikey={GOOGLE_MAPS_API_KEY}
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

					{/* Pickup marker — only rendered when coords are valid */}
					{isRideActive && pickupCoords && (
						<Marker
							coordinate={pickupCoords}
							title="Pickup Location"
							description={
								typeof acceptedRide.pickupLocation === 'object'
									? (acceptedRide.pickupLocation?.name || acceptedRide.pickupLocation?.address || "Pickup")
									: (acceptedRide.pickupLocation || "Pickup")
							}
							pinColor="#4caf50"
						/>
					)}

					{/* Destination marker — only rendered when coords are valid */}
					{isRideActive && destCoords && (
						<Marker
							coordinate={destCoords}
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
