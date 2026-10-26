import { StyleSheet, Pressable, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";
import { AntDesign } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabStore } from "../../constants/Store";

const HomeHeader = () => {
	const Back = useBottomTabStore((state) => state.backFromConfirm)
	const insets = useSafeAreaInsets();
	return (
		<Pressable
			style={[styles.drawerNav, { top: insets.top + 8 }]}
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
		left: 16,
	},
});
