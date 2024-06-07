import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { colors } from "../constants/styling";

const Terms = () => {
	return (
		<>
			<Text style={styles.terms}>
				By creating a new account,{"\n"} you agree to our{" "}
				<Text style={styles.conditions}>Terms and conditions</Text>
			</Text>
		</>
	);
};

export default Terms;

const styles = StyleSheet.create({
    terms: {
		textAlign: "center",
		marginBottom: 16,
		color: colors.lightGrey,
		fontWeight: "200",
	},
	conditions: {
		color: "black",
		fontWeight: "400",
		textDecorationLine: "underline",
	},
});
