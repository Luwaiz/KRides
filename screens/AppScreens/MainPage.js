import { Button, PermissionsAndroid, StyleSheet, View } from "react-native";
import React, { useEffect, useRef, useState, useMemo } from "react";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";
import ConfirmRide from "../../components/ConfirmRide";
import HomeHeader from "../../components/homeHeader/HomeHeader";
import PassengerHeader from "../../components/homeHeader/PassengerHeader";
import ConfirmHeader from "../../components/homeHeader/ConfirmHeader";
import { useBottomTabStore } from "../../constants/Store";
import { Map_Public } from "@env";
import Mapbox, {
	UserLocation,
	UserTrackingMode,
	PointAnnotation,
	ShapeSource,
	LineLayer,
} from "@rnmapbox/maps";
import Geolocation from "@react-native-community/geolocation";
import axios from "axios";
import { useRideDetailsStore } from "../../constants/Store";

const MainPage = () => {
	const [location, setLocation] = useState(false);
	const pickup = useRideDetailsStore((s) => s.pickupLocation);
	const destination = useRideDetailsStore((s) => s.destination);
	const [routeCoords, setRouteCoords] = useState(null); // array of [lng, lat]
	const [denseCoords, setDenseCoords] = useState(null); // densified for smoothing/animation
	const [movingIndex, setMovingIndex] = useState(0);
	const movingIntervalRef = useRef(null);

	const isPassengers = useBottomTabStore((state) => state.passengerPage);
	const confirm = useBottomTabStore((state) => state.confirmPage);
	// const ToHome = useBottomTabStore((state) => state.setHomePage);
	if (Map_Public) {
		Mapbox.setAccessToken(Map_Public);
	} else {
		console.error("❌ Mapbox token is missing!");
	}

	const BABCOCK_COORDINATES = (location && location.coords)
		? {
			latitude: location.coords.latitude,
			longitude: location.coords.longitude,
			zoom: 17,
		}
		: {
			latitude: 6.8935, // Replace with Babcock's central latitude
			longitude: 3.723, // Replace with Babcock's central longitude
			zoom: 17, // Adjust zoom level to focus only on the campus
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
		// No longer need socket for real-time updates - using Firestore listeners
	}, []);

	// Helper: densify simple linear interpolation between coords to smooth animation
	const densify = (coords, stepMeters = 10) => {
		if (!coords || coords.length < 2) return coords;
		const res = [];
		const R = 6371000; // earth radius
		const toRad = (d) => (d * Math.PI) / 180;
		const haversine = (a, b) => {
			const dLat = toRad(b[1] - a[1]);
			const dLon = toRad(b[0] - a[0]);
			const lat1 = toRad(a[1]);
			const lat2 = toRad(b[1]);
			const sinDLat = Math.sin(dLat / 2);
			const sinDLon = Math.sin(dLon / 2);
			const aa =
				sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
			const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
			return R * c;
		};

		for (let i = 0; i < coords.length - 1; i++) {
			const a = coords[i];
			const b = coords[i + 1];
			res.push(a);
			const dist = haversine(a, b);
			const steps = Math.max(0, Math.floor(dist / stepMeters));
			for (let s = 1; s < steps; s++) {
				const t = s / steps;
				const lng = a[0] + (b[0] - a[0]) * t;
				const lat = a[1] + (b[1] - a[1]) * t;
				res.push([lng, lat]);
			}
		}
		res.push(coords[coords.length - 1]);
		return res;
	};

	// Fetch driving route from Mapbox Directions API
	const fetchDrivingRoute = async (from, to) => {
		try {
			const token = Map_Public;
			const fromLong = parseFloat(from.longitude);
			const fromLat = parseFloat(from.latitude);
			const toLong = parseFloat(to.longitude);
			const toLat = parseFloat(to.latitude);

			const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLong},${fromLat};${toLong},${toLat}?geometries=geojson&overview=full&access_token=${token}`;
			const res = await axios.get(url);
			const coords = res?.data?.routes?.[0]?.geometry?.coordinates;
			if (coords && coords.length) {
				setRouteCoords(coords);
				const dense = densify(coords, 8); // 8 meters step for smoothing
				setDenseCoords(dense);
				return coords;
			}
		} catch (e) {
			console.warn(
				"Directions fetch failed, falling back to straight line",
				e?.message || e
			);
			const straight = [
				[parseFloat(from.longitude), parseFloat(from.latitude)],
				[parseFloat(to.longitude), parseFloat(to.latitude)],
			];
			setRouteCoords(straight);
			setDenseCoords(densify(straight, 8));
		}
	};

	// Watch pickup/destination and request route
	useEffect(() => {
		if (pickup && destination) {
			// Ensure we are passing objects with longitude/latitude properties
			// pickup.coord usually has { latitude, longitude }
			const pickupCoords = pickup.coord || pickup;
			const destCoords = destination.coord || destination;

			if (pickupCoords.latitude && pickupCoords.longitude && destCoords.latitude && destCoords.longitude) {
				fetchDrivingRoute(pickupCoords, destCoords);
			}
		} else {
			setRouteCoords(null);
			setDenseCoords(null);
		}
	}, [pickup, destination]);

	// animate a moving marker along the densified route
	useEffect(() => {
		if (!denseCoords || denseCoords.length === 0) {
			if (movingIntervalRef.current) {
				clearInterval(movingIntervalRef.current);
				movingIntervalRef.current = null;
				setMovingIndex(0);
			}
			return;
		}
		// reset
		setMovingIndex(0);
		if (movingIntervalRef.current) clearInterval(movingIntervalRef.current);
		movingIntervalRef.current = setInterval(() => {
			setMovingIndex((i) => {
				const next = i + 1;
				if (next >= denseCoords.length) {
					clearInterval(movingIntervalRef.current);
					movingIntervalRef.current = null;
					return i;
				}
				return next;
			});
		}, 700); // move every 700ms (tweak for speed)

		return () => {
			if (movingIntervalRef.current) {
				clearInterval(movingIntervalRef.current);
				movingIntervalRef.current = null;
			}
		};
	}, [denseCoords]);

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
			{Map_Public ? (
				<Mapbox.MapView style={styles.map}>
					<Mapbox.Camera
						centerCoordinate={[
							BABCOCK_COORDINATES.longitude,
							BABCOCK_COORDINATES.latitude,
						]}
						zoomLevel={BABCOCK_COORDINATES.zoom}
					/>

					{/* User's current location - always visible */}
					<Mapbox.LocationPuck
						visible={true}
						pulsing={{
							isEnabled: true,
							color: "blue",
							radius: 50.0,
						}}
					/>

					{/* Route line - only visible when ride is active */}
					{routeCoords && (
						<ShapeSource
							id="routeSource"
							shape={{
								type: "Feature",
								geometry: {
									type: "LineString",
									coordinates: routeCoords,
								},
							}}
						>
							<LineLayer
								id="routeLine"
								style={{
									lineColor: "#007AFF",
									lineWidth: 4,
									lineCap: "round",
									lineJoin: "round",
								}}
							/>
						</ShapeSource>
					)}

					{/* Pickup marker - only visible when ride is active */}
					{pickup && (
						<PointAnnotation
							id="pickup"
							coordinate={[
								parseFloat(pickup.coord?.longitude || pickup.longitude),
								parseFloat(pickup.coord?.latitude || pickup.latitude)
							]}
						>
							<View
								style={{
									width: 24,
									height: 24,
									borderRadius: 12,
									backgroundColor: "#4caf50",
									borderWidth: 3,
									borderColor: "#fff",
								}}
							/>
						</PointAnnotation>
					)}

					{/* Destination marker - only visible when ride is active */}
					{destination && (
						<PointAnnotation
							id="destination"
							coordinate={[
								parseFloat(destination.coord?.longitude || destination.longitude),
								parseFloat(destination.coord?.latitude || destination.latitude)
							]}
						>
							<View
								style={{
									width: 24,
									height: 24,
									borderRadius: 12,
									backgroundColor: "#1976D2",
									borderWidth: 3,
									borderColor: "#fff",
								}}
							/>
						</PointAnnotation>
					)}
				</Mapbox.MapView>
			) : (
				<View
					style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
				>
					<Text>Map loading or configuration error...</Text>
				</View>
			)}

			{/* Bottom Sheet */}
			{BottomSheetComponents}
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
