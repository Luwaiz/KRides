import { Button, PermissionsAndroid, StyleSheet, View, Text } from "react-native";
import React, { useEffect, useRef, useState, useMemo } from "react";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";
import ConfirmRide from "../../components/ConfirmRide";
import HomeHeader from "../../components/homeHeader/HomeHeader";
import PassengerHeader from "../../components/homeHeader/PassengerHeader";
import ConfirmHeader from "../../components/homeHeader/ConfirmHeader";
import { useBottomTabStore } from "../../constants/Store";
import { GOOGLE_MAPS_API_KEY } from "@env";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Geolocation from "@react-native-community/geolocation";
import { useRideDetailsStore } from "../../constants/Store";

const MainPage = () => {
	const [location, setLocation] = useState(false);
	const pickup = useRideDetailsStore((s) => s.pickupLocation);
	const destination = useRideDetailsStore((s) => s.destination);
	const mapRef = useRef(null);

	const isPassengers = useBottomTabStore((state) => state.passengerPage);
	const confirm = useBottomTabStore((state) => state.confirmPage);

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
								edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
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
					{pickup && destination && (
						<MapViewDirections
							origin={{
								latitude: parseFloat((pickup.coord || pickup).latitude),
								longitude: parseFloat((pickup.coord || pickup).longitude)
							}}
							destination={{
								latitude: parseFloat((destination.coord || destination).latitude),
								longitude: parseFloat((destination.coord || destination).longitude)
							}}
							apikey={GOOGLE_MAPS_API_KEY || "AIzaSyB7fe6OfWqZs2BP0AoZS-2jLi5mIVbiYTM"}
							strokeWidth={4}
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
