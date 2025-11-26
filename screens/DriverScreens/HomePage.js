import {
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useEffect, useState, useMemo } from "react";
import { colors } from "../../constants/styling";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import HomeTab from "../../components/DriversModal/HomeTab";
import HomeHeader from "../../components/DriverHeader/HomeHeader";
import { useBottomTabStore, useAcceptedRideStore } from "../../constants/Store";
import AcceptTab from "../../components/DriversModal/AcceptTab";
import AcceptHeader from "../../components/DriverHeader/AcceptHeader";
import { Map_Public } from "@env";
import Mapbox, {
	UserLocation,
	PointAnnotation,
	ShapeSource,
	LineLayer,
} from "@rnmapbox/maps";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HomePage = () => {
	const Accept = useBottomTabStore((state) => state.AcceptRidePage);
	const ToHome = useBottomTabStore((state) => state.setHomePage);
	const acceptedRide = useAcceptedRideStore((state) => state.acceptedRide);
	const isRideActive = useAcceptedRideStore((state) => state.isRideActive);
	const navigation = useNavigation();

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

	if (Map_Public) {
		Mapbox.setAccessToken(Map_Public);
	} else {
		console.error("❌ Mapbox token is missing!");
	}

	const BABCOCK_COORDINATES = {
		latitude: 6.8935,
		longitude: 3.723,
		zoom: 15,
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

	// Create route line from pickup to destination
	const routeGeoJSON = useMemo(() => {
		if (!acceptedRide?.pickupCoords || !acceptedRide?.destinationCoords) {
			return null;
		}

		return {
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates: [
					[
						parseFloat(acceptedRide.pickupCoords.longitude),
						parseFloat(acceptedRide.pickupCoords.latitude),
					],
					[
						parseFloat(acceptedRide.destinationCoords.longitude),
						parseFloat(acceptedRide.destinationCoords.latitude),
					],
				],
			},
		};
	}, [acceptedRide]);

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

					{/* Driver's current location - always visible */}
					<Mapbox.LocationPuck
						visible={true}
						pulsing={{
							isEnabled: true,
							color: "blue",
							radius: 50.0,
						}}
					/>

					{/* Route line - only visible when ride is active */}
					{isRideActive && acceptedRide && routeGeoJSON && (
						<ShapeSource id="routeSource" shape={routeGeoJSON}>
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
					{isRideActive && acceptedRide?.pickupCoords && (
						<PointAnnotation
							id="pickup"
							coordinate={[
								parseFloat(acceptedRide.pickupCoords.longitude),
								parseFloat(acceptedRide.pickupCoords.latitude),
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
					{isRideActive && acceptedRide?.destinationCoords && (
						<PointAnnotation
							id="destination"
							coordinate={[
								parseFloat(acceptedRide.destinationCoords.longitude),
								parseFloat(acceptedRide.destinationCoords.latitude),
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
		flex: 0.1,
		zIndex: 999,
	},
});
