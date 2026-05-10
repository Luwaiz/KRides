import { StyleSheet, Pressable } from "react-native";
import React from "react";
import { Octicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../constants/styling";

const HomeHeader = () => {
	const navigation = useNavigation();
	const OpenSettings = () => {
		navigation.navigate("Settings");
	};
	return (
		<Pressable
			style={styles.drawerNav}
			onPress={OpenSettings}
		>
			<Octicons name="three-bars" size={24} color="black" />
		</Pressable>
	);
};

export default HomeHeader;

const styles = StyleSheet.create({
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
