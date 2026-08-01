import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Network from "expo-network";

// The app previously had no way to distinguish "offline" from a generic
// error — a dropped connection surfaced as a raw fetch/Firestore error with
// no actionable guidance. This renders a persistent banner whenever the
// device has no usable connection, across every screen.
const NetworkBanner = () => {
	const networkState = Network.useNetworkState();

	// isInternetReachable can be undefined briefly while the OS is still
	// determining state — only show the banner once we're confident there's
	// no connection, not during that initial undefined window.
	const isOffline =
		networkState.isConnected === false ||
		networkState.isInternetReachable === false;

	if (!isOffline) return null;

	return (
		<SafeAreaView edges={["top"]} style={styles.safeArea} pointerEvents="none">
			<View style={styles.banner}>
				<Text style={styles.text}>No internet connection</Text>
			</View>
		</SafeAreaView>
	);
};

export default NetworkBanner;

const styles = StyleSheet.create({
	safeArea: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 9999,
		backgroundColor: "#d32f2f",
	},
	banner: {
		paddingVertical: 6,
		alignItems: "center",
		justifyContent: "center",
	},
	text: {
		color: "white",
		fontSize: 12,
		fontFamily: "Albert-SemiBold",
	},
});
