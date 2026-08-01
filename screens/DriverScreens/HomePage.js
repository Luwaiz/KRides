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
import { useAcceptedRideStore, useDriverAvailability } from "../../constants/Store";
import AcceptTab from "../../components/DriversModal/AcceptTab";
import AcceptHeader from "../../components/DriverHeader/AcceptHeader";
import { GOOGLE_MAPS_API_KEY } from "@env";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Geolocation from "@react-native-community/geolocation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";
import notificationManager from "../../helpers/notificationManager";
import { useDriverDetails } from "../../constants/Store";
import Toast from "react-native-toast-message";

const HomePage = () => {
	const acceptedRide = useAcceptedRideStore((state) => state.acceptedRide);
	const isRideActive = useAcceptedRideStore((state) => state.isRideActive);
	const navigation = useNavigation();
	const mapRef = useRef(null);
	const [mapReady, setMapReady] = useState(false);
	const { uid } = useDriverDetails((state) => ({ uid: state.uid }));
	const directionsErrorShown = useRef(false);

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
				Toast.show({
					type: 'tomatoToast',
					text1: 'Location Access Needed',
					text2: "Enable location for KRides in your device settings — riders can't be matched to you without it.",
					position: 'top',
					visibilityTime: 6000,
				});
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

	// Register for push notifications. notificationManager also clears any
	// stale token left behind by a previous account on this device before
	// writing this driver's token — see helpers/notificationManager.js.
	useEffect(() => {
		if (!uid) return;
		notificationManager.initialize(uid, 'driver').catch((error) => {
			console.error("❌ Error setting up notifications:", error);
		});
	}, [uid]);

	const isOnline = useDriverAvailability((state) => state.isOnline);

	// Track driver location — while online, and (independent of the online
	// toggle) for the duration of an active ride, so the rider's map can show
	// it. Lives here rather than in HomeTab so it keeps running across the
	// HomeTab → AcceptTab switch instead of stopping the moment a ride is
	// accepted. activeRideCustomerId is denormalized onto the location doc so
	// firestore.rules can grant read access to just that one rider.
	useEffect(() => {
		if (!uid || !(isOnline || acceptedRide)) return;

		const activeRideCustomerId = acceptedRide?.customerId || null;
		const locationRef = doc(FIREBASE_DB, "driver_locations", uid);

		// Write immediately on ride-state change, decoupled from the next GPS
		// fix — otherwise a rider whose ride just ended could keep read access
		// until the driver's position next updates.
		setDoc(locationRef, { activeRideCustomerId }, { merge: true }).catch(() => {});

		const watchId = Geolocation.watchPosition(
			(position) => {
				setDoc(locationRef, {
					location: {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					},
					locationUpdatedAt: serverTimestamp(),
					activeRideCustomerId,
				}, { merge: true }).catch(() => {});
			},
			(error) => {
				console.warn("⚠️ Location tracking error:", error);
			},
			{ enableHighAccuracy: true, distanceFilter: 10, interval: 10000 }
		);

		return () => {
			try {
				Geolocation.clearWatch(watchId);
			} catch (e) {
				console.warn('⚠️ Geolocation.clearWatch failed:', e.message);
			}
		};
	}, [uid, isOnline, acceptedRide?.rideId, acceptedRide?.customerId]);

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
								console.warn('⚠️ Directions error:', errorMessage);
								if (!directionsErrorShown.current) {
									directionsErrorShown.current = true;
									Toast.show({
										type: 'tomatoToast',
										text1: 'Could Not Load Route',
										text2: 'The route line may not display — use your regular navigation app to get there.',
										position: 'top',
										visibilityTime: 4000,
									});
								}
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
