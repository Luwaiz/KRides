import { Button, PermissionsAndroid, StyleSheet, View } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";
import AvailableRiders from "../../components/AvailableRiders";
import ConfirmRide from "../../components/ConfirmRide";
import HomeHeader from "../../components/homeHeader/HomeHeader";
import PassengerHeader from "../../components/homeHeader/PassengerHeader";
import ConfirmHeader from "../../components/homeHeader/ConfirmHeader";
import RiderHeader from "../../components/homeHeader/RiderHeader";
import { useBottomTabStore } from "../../constants/Store";
import { Map_Public } from "@env";
import Mapbox, { UserLocation, UserTrackingMode } from "@rnmapbox/maps";
import Geolocation from "@react-native-community/geolocation";
const MainPage = () => {
	const [location, setLocation] = useState(false);
	console.log("geolocation", Geolocation);

	const isPassengers = useBottomTabStore((state) => state.passengerPage);
	const isRider = useBottomTabStore((state) => state.riderPage);
	const confirm = useBottomTabStore((state) => state.confirmPage);
	// const ToHome = useBottomTabStore((state) => state.setHomePage);
	Mapbox.setAccessToken(Map_Public);

	const BABCOCK_COORDINATES = {
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
				console.log("permission granted ", permission);
				return true;
			} else {
				console.log("Permission denied ", permission);
				return false;
			}
		} catch (e) {
			console.log("Failed to get location permissions", e);
		}
	};

	const getLocationN = async () => {
		console.log("locate me",location)
		const response = await requestLocationPermissions();
		console.log(response);
		try {
			if (response) {
				Geolocation.getCurrentPosition(
					(position) => {
						console.log("Position:", position);
						setLocation(position);
					},
					(error) => {
						console.log("Error getting location:", error);
						setLocation(false);
					},
					{ enableHighAccuracy: false, timeout: 15000 }
				);
			} else {
				console.log("Location permission not granted");
			}
		} catch (error) {
			console.log("Error:", error);
		}
	};

	useEffect (()=>{
		getLocationN()
	},[])
	const HeaderComponents = () => {
		if (isPassengers) {
			if (isRider) {
				if (confirm) {
					return <ConfirmHeader />;
				} else {
					return <RiderHeader />;
				}
			} else {
				return <PassengerHeader />;
			}
		} else {
			return <HomeHeader />;
		}
	};

	const BottomSheetComponents = () => {
		if (isPassengers) {
			if (isRider) {
				if (confirm) {
					return <ConfirmRide />;
				} else {
					return <AvailableRiders />;
				}
			} else {
				return <Passenger />;
			}
		} else {
			return <HomeTab />;
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.head}>
				<HeaderComponents />
			</View>
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
			</Mapbox.MapView>
			<BottomSheetComponents />
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
		height: "60%"
	},
	head: {
		flex: 0.1,
		zIndex: 999,
	},
});
