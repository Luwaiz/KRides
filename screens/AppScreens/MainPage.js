import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { Octicons } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import HomeTab from "../../components/HomeTab";
import Passenger from "../../components/Passenger";


const MainPage = () => {
	const navigation = useNavigation();
	const [isPassengers, setIsPassengers] = useState(false);
	const Passengers = () => {
		setIsPassengers(true);
	};

	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};
	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.drawerNav}
				activeOpacity={0.7}
				onPress={OpenDrawer}
			>
				<View>
					<Octicons name="three-bars" size={24} color="black" />
				</View>
			</TouchableOpacity>
		{isPassengers ? <Passenger/> : <HomeTab Passengers={Passengers}/>}
		</View>
	);
};

export default MainPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		backgroundColor: colors.lightGrey2,
	},
	drawerNav: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		position: "absolute",
		top: 40,
		left: 16,
	},
});
