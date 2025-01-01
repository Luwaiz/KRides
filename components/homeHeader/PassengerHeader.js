import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import React from "react";
import { AntDesign } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { useBottomTabStore } from "../../constants/Store";

const PassengerHeader = () => {
	const Back = useBottomTabStore((state)=>state.PassengerPage)
	
	return (
		<View style={styles.container}>
			<Pressable onPress={Back} style={styles.backButton}>
				<AntDesign name="arrowleft" size={24} color="black" />
			</Pressable>
			<View style={styles.searchBox}>
				<AntDesign name="search1" size={20} color="black" />
				<TextInput style={styles.search} placeholder="BUSA HOUSE" cursorColor={"black"}></TextInput>
			</View>
		</View>
	);
};

export default PassengerHeader;

const styles = StyleSheet.create({
	container: {
		width: "90%",
		backgroundColor: colors.secondary,
		alignSelf: "center",
		borderRadius: 10,
		position: "absolute",
		top: 40,
		height: 50,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 8,
	},
	backButton: {
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	searchBox: {
		width: "88%",
		height: 40,
		backgroundColor: colors.lightGrey2,
		borderRadius: 8,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	search:{
		width: "90%",
        height: "100%",
	}
});
