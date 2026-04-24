import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import React from "react";
import { colors } from "../../constants/styling";

//active button component
const ActiveButton = ({ title, onPress, disabled, loading }) => {
	return (
		<TouchableOpacity disabled={disabled || loading} onPress={onPress} activeOpacity={0.5}>
			<View style={[styles.button, disabled && styles.buttonDisabled]}>
				{loading ? (
					<ActivityIndicator color={colors.secondary} />
				) : (
					<Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{title}</Text>
				)}
			</View>
		</TouchableOpacity>
	);
};

export default ActiveButton;

const styles = StyleSheet.create({
	button: {
		backgroundColor: colors.primaryBlue,
		minWidth: 167,
		height: 48,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonDisabled: {
		backgroundColor: colors.lightGrey2,
	},
	buttonTextDisabled: {
		color: colors.lightGrey3,
	},
	buttonText: {
		color: colors.secondary,
		fontSize: 16,
		fontWeight: "500",
	},
});
