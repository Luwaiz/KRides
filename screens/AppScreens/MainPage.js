import {
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useState } from "react";
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

const MainPage = () => {
	const navigation = useNavigation();
	const [isPassengers, setIsPassengers] = useState(false);
	const [isRider, setIsRider] = useState(false);
	const [confirm, setConfirm] = useState();

	const ToConfirm = () => {
		setConfirm(true);
	};

	const Riders = () => {
		setIsRider(true);
	};
	const Passengers = () => {
		setIsPassengers(true);
	};
	const BackToHome = () => {
		setIsPassengers(false);
	};
	const BackToPassengers = () => {
		setIsRider(false);
	};
	const BackToRiders = () => {
		setConfirm(false);
	};
	return (
		<View style={styles.container}>
			{isPassengers ? (
				isRider ? (
					confirm ? (
						<ConfirmHeader Back={BackToRiders} />
					) : (
						<RiderHeader Back={BackToPassengers} />
					)
				) : (
					<PassengerHeader Back={BackToHome} />
				)
			) : (
				<HomeHeader />
			)}

			{isPassengers ? (
				isRider ? (
					confirm ? (
						<ConfirmRide />
					) : (
						<AvailableRiders confirm={ToConfirm} />
					)
				) : (
					<Passenger riders={Riders} />
				)
			) : (
				<HomeTab Passengers={Passengers} />
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
