import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/styling";
import { checkAndFetchUpdate, applyFetchedUpdate } from "../helpers/otaUpdates";

const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

const UpdateBanner = () => {
	const [updateReady, setUpdateReady] = useState(false);
	const lastCheckRef = useRef(0);

	const runCheck = async () => {
		const now = Date.now();
		if (now - lastCheckRef.current < RECHECK_INTERVAL_MS) return;
		lastCheckRef.current = now;

		const fetched = await checkAndFetchUpdate();
		if (fetched) setUpdateReady(true);
	};

	useEffect(() => {
		runCheck();

		const subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState === "active") runCheck();
		});
		return () => subscription.remove();
	}, []);

	if (!updateReady) return null;

	return (
		<SafeAreaView edges={["top"]} style={styles.safeArea}>
			<View style={styles.banner}>
				<Text style={styles.text}>An update is ready</Text>
				<TouchableOpacity onPress={applyFetchedUpdate} style={styles.button}>
					<Text style={styles.buttonText}>Restart</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
};

export default UpdateBanner;

const styles = StyleSheet.create({
	safeArea: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 9999,
		backgroundColor: colors.primaryBlue,
	},
	banner: {
		paddingVertical: 6,
		paddingHorizontal: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	text: {
		color: "white",
		fontSize: 12,
		fontFamily: "Albert-SemiBold",
	},
	button: {
		paddingHorizontal: 10,
		paddingVertical: 3,
		borderRadius: 6,
		backgroundColor: "rgba(255,255,255,0.2)",
	},
	buttonText: {
		color: "white",
		fontSize: 12,
		fontFamily: "Albert-Bold",
	},
});
