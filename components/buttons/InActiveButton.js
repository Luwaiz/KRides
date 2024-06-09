import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";

// Inactive button component
const InActiveButton = ({title,onPress}) => {
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.5}>
			<View style={styles.button}>
				<Text style={styles.buttonText}>{title}</Text>
			</View>
		</TouchableOpacity>
	);
};

export default InActiveButton;

const styles = StyleSheet.create({
	button: {
		backgroundColor: colors.secondary,
		minWidth: 167,
		height: 48,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
		top: 0,
		left: 0,
		right: 69,
	},
	buttonText: {
		fontSize: 16,
		color:colors.lightGrey,
        fontWeight:"300"
	},
});
