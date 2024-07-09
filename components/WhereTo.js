import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import Direction from "../assets/svg/Frame 34direction.svg";

const WhereTo = () => {
	const navigation = useNavigation();
	const ToPickDestination = () => {
		navigation.navigate("Destinations");
	};

	return (
		<View style={styles.locations}>
			<View style={styles.pointer}>
				<Direction height={110} />
			</View>
			<View style={styles.destinations}>
				<TouchableOpacity activeOpacity={0.7} onPress={ToPickDestination}>
					<View style={styles.destination}>
						<Text style={styles.destinationText}>Choose Pickup Location</Text>
					</View>
				</TouchableOpacity>
				<TouchableOpacity activeOpacity={0.7} onPress={ToPickDestination}>
					<View style={styles.destination}>
						<Text style={styles.destinationText}>Choose Destination</Text>
					</View>
				</TouchableOpacity>
			</View>
		</View>
	);
};

export default WhereTo;

const styles = StyleSheet.create({
	locations: {
		alignSelf: "center",
		backgroundColor: colors.lightGrey2,
		width: "100%",
		height: 140,
		borderRadius: 16,
		flexDirection: "row",
	},
	destinations: {
		minWidth: 270,
		height: "100%",
		justifyContent: "space-between",
		paddingVertical: 10,
	},
	destination: {
		width: "100%",
		minHeight: 50,
		backgroundColor: colors.secondary,
		borderRadius: 8,
		padding: 8,
		justifyContent: "center",
	},
	destinationText: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
	},
	pointer: {
		marginTop:5
	}
});
