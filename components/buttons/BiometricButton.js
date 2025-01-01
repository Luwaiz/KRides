import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState } from "react";
import { colors } from "../../constants/styling";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import * as LocalAuthentication from "expo-local-authentication"

const BiometricButton = ({navigate}) => {

	const [isBiometrics, setIsBiometrics] = useState(null);

    useEffect(() => {
		(async () => {
			const compatibility = await LocalAuthentication.hasHardwareAsync();
			setIsBiometrics(compatibility);
		})();
	}, []);
	const handleBiometrics = async () => {
		const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
		if (!biometricAvailable) {
			alert("Biometrics not available");
			return;
		}
		let supportedBiometrics;
		if (biometricAvailable) {
			supportedBiometrics =
				await LocalAuthentication.supportedAuthenticationTypesAsync();
		}
		const fingerprint = await LocalAuthentication.isEnrolledAsync();
		if (!fingerprint) {
			alert("No fingerprint enrolled.");
			return;
		}
		const bioAvailable = await LocalAuthentication.authenticateAsync({
			promptMessage: "LogIn to account",
			cancelLabel: "cancel",
			disableDeviceFallback: true,
		});
		if (bioAvailable.success) {
			navigate()
			console.log(isBiometrics);
		} else if (
			bioAvailable.error === "user_cancel" ||
			bioAvailable.error === "user_fallback"
		) {
			alert("Authentication canceled.");
		} else {
			alert("Authentication failed. Please try again.");
		}
	};
	return (
		<TouchableOpacity onPress={handleBiometrics} activeOpacity={0.5}>
			<View style={styles.button}>
				<FontAwesome5 name="fingerprint" size={24} color={colors.secondary2} />
			</View>
		</TouchableOpacity>
	);
};

export default BiometricButton;

const styles = StyleSheet.create({
	button: {
		backgroundColor: colors.primaryBlue,
		minWidth: 48,
		height: 48,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
});
