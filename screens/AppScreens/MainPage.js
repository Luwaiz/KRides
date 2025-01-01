import {
	Button,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useEffect, useState } from "react";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";
import AvailableRiders from "../../components/AvailableRiders";
import MapView from "react-native-maps";
import ConfirmRide from "../../components/ConfirmRide";
import HomeHeader from "../../components/homeHeader/HomeHeader";
import PassengerHeader from "../../components/homeHeader/PassengerHeader";
import ConfirmHeader from "../../components/homeHeader/ConfirmHeader";
import RiderHeader from "../../components/homeHeader/RiderHeader";
import { useBottomTabStore } from "../../constants/Store";
import Mapbox from "@rnmapbox/maps";

const MainPage = () => {
	const isPassengers = useBottomTabStore((state) => state.passengerPage);
	const isRider = useBottomTabStore((state) => state.riderPage);
	const confirm = useBottomTabStore((state) => state.confirmPage);
	const ToHome = useBottomTabStore((state) => state.setHomePage);

	const Map_Secret = "sk.eyJ1IjoiZWx1d2FpeiIsImEiOiJjbTVibXJsNWk0ZXE4MmpwN2FvNjJ2cmJ3In0.ITvpOypF_zViRDy3hHU8OA"
    const Map_Public = "pk.eyJ1IjoiZWx1d2FpeiIsImEiOiJjbTUzd3IyN2gyOTlkMnFzZmh5MTU3bTdoIn0.wGO4HMCpwQq7vVrnCWkF2w"
	const BABCOCK_COORDINATES = {
		latitude: 6.8935, // Replace with Babcock's central latitude
		longitude: 3.723, // Replace with Babcock's central longitude
		zoom: 17, // Adjust zoom level to focus only on the campus
	};
	Mapbox.setAccessToken("pk.eyJ1IjoiZWx1d2FpeiIsImEiOiJjbTUzd3IyN2gyOTlkMnFzZmh5MTU3bTdoIn0.wGO4HMCpwQq7vVrnCWkF2w")

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
					<Mapbox.Camera
						centerCoordinate={[
							BABCOCK_COORDINATES.longitude,
							BABCOCK_COORDINATES.latitude,
						]}
						zoomLevel={BABCOCK_COORDINATES.zoom}
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
		backgroundColor: "green",
	},
	map: {
		...StyleSheet.absoluteFill,
		
			},
	head: {
        flex: 0.1,
		zIndex:999
    },
});
