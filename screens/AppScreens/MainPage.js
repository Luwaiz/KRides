import {
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useEffect, useState } from "react";
import { colors } from "../../constants/styling";
import { DrawerActions, useNavigation } from "@react-navigation/native";
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

const MainPage = () => {
	const isPassengers = useBottomTabStore((state) => state.passengerPage);
	const isRider = useBottomTabStore((state) => state.riderPage);
	const confirm = useBottomTabStore((state) => state.confirmPage);
	const ToHome = useBottomTabStore((state) => state.setHomePage);
	const navigation = useNavigation();

	useEffect(() => {
		const unSubscribe = navigation.addListener("focus", () => {
			ToHome();
		});
		return unSubscribe;
	}, [navigation]);

	return (
		<View style={styles.container}>
			{isPassengers ? (
				isRider ? (
					confirm ? (
						<ConfirmHeader />
					) : (
						<RiderHeader />
					)
				) : (
					<PassengerHeader />
				)
			) : (
				<HomeHeader />
			)}

			{isPassengers ? (
				isRider ? (
					confirm ? (
						<ConfirmRide />
					) : (
						<AvailableRiders />
					)
				) : (
					<Passenger />
				)
			) : (
				<HomeTab />
			)}
		</View>
	);
};

export default MainPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.lightGrey2,
	},
	map: {
		...StyleSheet.absoluteFillObject,
	},
});
