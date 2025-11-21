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

	Mapbox.setAccessToken(Map_Public);

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
						acceptedRide.pickupCoords.longitude,
						acceptedRide.pickupCoords.latitude,
					],
					[
						acceptedRide.destinationCoords.longitude,
						acceptedRide.destinationCoords.latitude,
					],
				],
			},
		};
	}, [acceptedRide]);

	return (
		<View style={styles.container}>
			{HeaderComponents}

			{/* Show map when ride is accepted */}
			{isRideActive && acceptedRide && (
				<Mapbox.MapView style={styles.map}>
					<Mapbox.Camera
						centerCoordinate={[
							BABCOCK_COORDINATES.longitude,
							BABCOCK_COORDINATES.latitude,
						]}
						zoomLevel={BABCOCK_COORDINATES.zoom}
					/>

					<Mapbox.LocationPuck
						visible={true}
						pulsing={{
							isEnabled: true,
							color: "blue",
							radius: 50.0,
						}}
					/>

					{/* Route line */}
					{routeGeoJSON && (
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

					{/* Pickup marker */}
					{acceptedRide.pickupCoords && (
						<PointAnnotation
							id="pickup"
							coordinate={[
								acceptedRide.pickupCoords.longitude,
								acceptedRide.pickupCoords.latitude,
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

					{/* Destination marker */}
					{acceptedRide.destinationCoords && (
						<PointAnnotation
							id="destination"
							coordinate={[
								acceptedRide.destinationCoords.longitude,
								acceptedRide.destinationCoords.latitude,
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
});
