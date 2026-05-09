import { StyleSheet, Pressable, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";
import { AntDesign } from "@expo/vector-icons";
import { useBottomTabStore } from "../../constants/Store";

const HomeHeader = () => {
	const Back = useBottomTabStore((state) => state.backFromConfirm)
	return (
		<Pressable
			style={styles.drawerNav}
			onPress={Back}
		>
			<AntDesign name="arrowleft" size={24} color="black" />
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
