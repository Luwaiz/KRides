import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import useAuthStore, { useDriverDetails, useUserDetails } from "../constants/Store";
import { colors } from "../constants/styling";

// Shown to a signed-in driver until their driver profile has been loaded. The app has to know
// whether the bank details are verified before choosing between the dashboard and the bank
// screen, and must not guess: a failed or slow load would otherwise look like "not verified"
// (blocking a verified driver) or, worse, be treated as "fine" (letting an unverified one in).
const DriverProfileGate = () => {
	const [failed, setFailed] = useState(false);

	const load = useCallback(async () => {
		setFailed(false);
		try {
			const uid = FIREBASE_AUTH.currentUser?.uid;
			if (!uid) throw new Error("Not signed in");
			const snap = await getDoc(doc(FIREBASE_DB, "drivers", uid));
			if (!snap.exists()) throw new Error("No driver profile");
			useDriverDetails.getState().setDriverProfile({ ...snap.data(), uid });
		} catch (error) {
			console.warn("⚠️ Could not load driver profile:", error.message);
			setFailed(true);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const logOut = async () => {
		await signOut(FIREBASE_AUTH).catch(() => {});
		useUserDetails.getState().clearUser();
		useDriverDetails.getState().clearDriver();
		useAuthStore.getState().clearAuth();
	};

	return (
		<SafeAreaView style={styles.container}>
			{failed ? (
				<View style={styles.box}>
					<Text style={styles.title}>Couldn't load your account</Text>
					<Text style={styles.text}>
						Check your internet connection and try again.
					</Text>
					<TouchableOpacity style={styles.button} onPress={load}>
						<Text style={styles.buttonText}>Try again</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={logOut}>
						<Text style={styles.link}>Log out</Text>
					</TouchableOpacity>
				</View>
			) : (
				<ActivityIndicator size="large" color={colors.primaryBlue} />
			)}
		</SafeAreaView>
	);
};

export default DriverProfileGate;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
	},
	box: {
		alignItems: "center",
		paddingHorizontal: 32,
		gap: 12,
	},
	title: {
		fontSize: 20,
		fontFamily: "Albert-SemiBold",
		textAlign: "center",
	},
	text: {
		fontSize: 15,
		color: colors.lightGrey3,
		textAlign: "center",
	},
	button: {
		marginTop: 8,
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 10,
		backgroundColor: colors.primaryBlue,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
	},
	link: {
		marginTop: 8,
		fontSize: 15,
		color: colors.primaryBlue,
	},
});
