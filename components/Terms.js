import { Linking, StyleSheet, Text, View } from "react-native";
import React from "react";
import { colors } from "../constants/styling";
import { PRIVACY_POLICY_URL, TERMS_URL } from "../constants/legal";

const Terms = () => {
	return (
		<>
			<Text style={styles.terms}>
				By creating a new account,{"\n"} you agree to our{" "}
				<Text style={styles.conditions} onPress={() => Linking.openURL(TERMS_URL)}>
					Terms and Conditions
				</Text>{" "}
				and{" "}
				<Text style={styles.conditions} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
					Privacy Policy
				</Text>
			</Text>
		</>
	);
};

export default Terms;

const styles = StyleSheet.create({
    terms: {
		textAlign: "center",
		marginBottom: 16,
		paddingHorizontal: 32,
		color: colors.lightGrey,
		fontWeight: "200",
	},
	conditions: {
		color: "black",
		fontWeight: "400",
		textDecorationLine: "underline",
	},
});
