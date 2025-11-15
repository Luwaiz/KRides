import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import React from "react";
import { AntDesign } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { useBottomTabStore } from "../../constants/Store";

const PassengerHeader = () => {
	const Back = useBottomTabStore((state)=>state.PassengerPage)
	
	return (
		<View style={styles.drawerNav} activeOpacity={0.7}>
			<Pressable onPress={Back} style={styles.backButton}>
				<AntDesign name="arrowleft" size={24} color="black" />
			</Pressable>
		</View>
	);
};

export default PassengerHeader;

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
