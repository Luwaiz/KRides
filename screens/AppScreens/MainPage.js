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
	Mapbox.setAccessToken(Map_Public);

	const BABCOCK_COORDINATES = location
		? {
				latitude: location?.coord?.latitude, // Replace with Babcock's central latitude
				longitude: location?.coord?.longitude, // Replace with Babcock's central longitude
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
		} catch (e) {}
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
		} catch (error) {}
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
			const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?geometries=geojson&overview=full&access_token=${token}`;
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
				[from.longitude, from.latitude],
				[to.longitude, to.latitude],
			];
			setRouteCoords(straight);
			setDenseCoords(densify(straight, 8));
		}
	};

	// Watch pickup/destination and request route
	useEffect(() => {
		if (pickup && destination) {
			fetchDrivingRoute(pickup, destination);
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
			<Mapbox.MapView style={styles.map}>
				<Mapbox.UserLocation
					// onUpdate={(newLocation) => setLocation(newLocation)}
					visible={false}
				/>
				<Mapbox.Camera
					centerCoordinate={[
						BABCOCK_COORDINATES.longitude,
						BABCOCK_COORDINATES.latitude,
					]}
					zoomLevel={BABCOCK_COORDINATES.zoom}
					followUserLocation={true}
					followUserMode={UserTrackingMode.Follow}
					followZoomLevel={17}
				/>
				<Mapbox.LocationPuck
					visible={location ? true : false}
					scale={["interpolate", ["linear"], ["zoom"], 10, 1.0, 20, 4.0]}
					pulsing={{
						isEnabled: true,
						color: "teal",
						radius: 50.0,
					}}
				/>

				{/* Draw route if present */}
				{routeCoords && (
					<ShapeSource
						id="routeSource"
						shape={{
							type: "Feature",
							geometry: { type: "LineString", coordinates: routeCoords },
						}}
					>
						<LineLayer
							id="routeLine"
							style={{
								lineColor: "#1976D2",
								lineWidth: 5,
								lineCap: "round",
								lineJoin: "round",
							}}
						/>
					</ShapeSource>
				)}

				{/* moving marker (animated along denseCoords) */}
				{denseCoords && denseCoords[movingIndex] && (
					<PointAnnotation
						id={`moving`}
						coordinate={[
							denseCoords[movingIndex][0],
							denseCoords[movingIndex][1],
						]}
					>
						<View
							style={{
								width: 20,
								height: 20,
								borderRadius: 10,
								backgroundColor: "#ff3b30",
								borderWidth: 2,
								borderColor: "#fff",
							}}
						/>
					</PointAnnotation>
				)}

				{/* start and end markers */}
				{pickup && (
					<PointAnnotation
						id="pickup"
						coordinate={[pickup.longitude, pickup.latitude]}
					>
						<View
							style={{
								width: 18,
								height: 18,
								borderRadius: 9,
								backgroundColor: "#4caf50",
								borderWidth: 2,
								borderColor: "#fff",
							}}
						/>
					</PointAnnotation>
				)}
				{destination && (
					<PointAnnotation
						id="destination"
						coordinate={[destination.longitude, destination.latitude]}
					>
						<View
							style={{
								width: 18,
								height: 18,
								borderRadius: 9,
								backgroundColor: "#1976D2",
								borderWidth: 2,
								borderColor: "#fff",
							}}
						/>
					</PointAnnotation>
				)}
			</Mapbox.MapView>
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
