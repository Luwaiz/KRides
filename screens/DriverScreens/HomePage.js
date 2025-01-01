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
import HomeTab from "../../components/DriversModal/HomeTab";
import HomeHeader from "../../components/DriverHeader/HomeHeader";
import { useBottomTabStore } from "../../constants/Store";
import AcceptTab from "../../components/DriversModal/AcceptTab";
import AcceptHeader from "../../components/DriverHeader/AcceptHeader";

const HomePage = () => {
	const Accept = useBottomTabStore((state) => state.AcceptRidePage);
	const ToHome = useBottomTabStore((state) => state.setHomePage);
	const navigation = useNavigation();

	const HeaderComponents = () => {
		if (Accept) {
			return <AcceptHeader />;
		} else {
			return <HomeHeader />;
		}
	};

	const BottomSheetComponents = () => {
		if (Accept) {
			return <AcceptTab />;
		} else {
			return <HomeTab />;
		}
	};

	return (
		<View style={styles.container}>
        <HeaderComponents/>
			<BottomSheetComponents />
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
		...StyleSheet.absoluteFill,
	},
});
