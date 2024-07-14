import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { TouchableOpacity } from "react-native-gesture-handler";
import { colors } from "../../constants/styling";
import { AntDesign } from "@expo/vector-icons";
import { useBottomTabStore } from "../../constants/Store";

const HomeHeader = () => {
	const Back = useBottomTabStore((state)=>state.setConfirmPage)
	return (
		<TouchableOpacity
			style={styles.drawerNav}
			activeOpacity={0.7}
			onPress={Back}
		>
			<View>
				<AntDesign name="arrowleft" size={24} color="black" />
			</View>
		</TouchableOpacity>
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
