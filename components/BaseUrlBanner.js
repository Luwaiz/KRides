import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BASE_URL } from "../hooks/API";

// Small QA banner that shows the effective BASE_URL. Only visible in dev builds.
const BaseUrlBanner = () => {
	if (!__DEV__) return null;
	return (
		<View style={styles.container} pointerEvents="none">
			<Text numberOfLines={1} style={styles.text}>
				{BASE_URL}
			</Text>
		</View>
	);
};

export default BaseUrlBanner;

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: Platform.OS === "android" ? 28 : 44,
		left: 8,
		right: 8,
		backgroundColor: "rgba(255,223,0,0.95)",
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 6,
		zIndex: 9999,
		alignItems: "center",
		elevation: 10,
	},
	text: {
		fontSize: 12,
		color: "#000",
		fontFamily: "Albert-Regular",
	},
});
