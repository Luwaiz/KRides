import {
	Image,
	Modal,
	StyleSheet,
	Text,
	View,
	Alert,
	ActivityIndicator,
} from "react-native";
import React, { useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import { CommonActions, useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
import useAuthStore, {
	useDriverDetails,
	useUserDetails,
} from "../../constants/Store";
import axios from "axios";
import API from "../../hooks/API";
import { FIREBASE_AUTH, FIREBASE_DB } from "../../firebaseConfig";
import { signOut, deleteUser as firebaseDeleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import Toast from "react-native-toast-message";
import { colors } from "../../constants/styling";

const Confirmation1 = ({ modal, setModal, title }) => {
	const navigation = useNavigation();
	const { accessToken, email, setAccessToken } = useUserDetails((state) => ({
		accessToken: state.accessToken,
		email: state.email,
		setAccessToken: state.setAccessToken,
	}));
	const [loading, setLoading] = useState(false);

	const ToAuthScreen = () => {
		// Don't close modal immediately, wait for async op
		if (title === "Logout") {
			logOut();
		} else {
			deleteUser();
		}
	};
	const Close = () => {
		setModal(false);
	};

	const deleteUser = async () => {
		try {
			setLoading(true);
			const currentUser = FIREBASE_AUTH.currentUser;

			if (!currentUser) {
				Alert.alert("Error", "No user is currently logged in.");
				setLoading(false);
				return;
			}

			console.log("🗑️ Starting account deletion process...");
			console.log("   - User ID:", currentUser.uid);
			console.log("   - Email:", currentUser.email);

			// Determine if user is a driver or customer based on store state
			const { role } = useAuthStore.getState();
			const collection = role === "driver" ? "drivers" : "users";

			console.log("   - Account type:", collection);

			// Step 1: Delete user document from Firestore
			try {
				const userDocRef = doc(FIREBASE_DB, collection, currentUser.uid);
				await deleteDoc(userDocRef);
				console.log("✅ User document deleted from Firestore");
			} catch (firestoreError) {
				console.error("❌ Error deleting Firestore document:", firestoreError);
				// Continue with auth deletion even if Firestore fails
			}

			// Step 2: Delete user from Firebase Authentication
			try {
				await firebaseDeleteUser(currentUser);
				console.log("✅ User deleted from Firebase Auth");
			} catch (authError) {
				console.error("❌ Error deleting Firebase Auth user:", authError);

				if (authError.code === "auth/requires-recent-login") {
					Alert.alert(
						"Re-authentication Required",
						"For security reasons, you need to log in again before deleting your account. Please log out and log back in, then try deleting your account again.",
						[{ text: "OK" }]
					);
					setLoading(false);
					setModal(false);
					return;
				}

				throw authError;
			}

			// Step 3: Clear all local stores
			useUserDetails.getState().clearUser();
			useDriverDetails.getState().clearDriver();
			useAuthStore.getState().clearAuth();

			console.log("✅ Account deletion completed successfully");

			// Step 4: Show success message and navigate to auth screen
			Toast.show({
				type: "tomatoToast",
				text1: "Account Deleted",
				text2: "Your account has been permanently deleted",
				text2Style: { flexWrap: "wrap", maxWidth: 250 },
				position: "top",
				visibilityTime: 5000,
			});

			// Navigate to AuthStack
			setModal(false);
			navigation.dispatch(
				CommonActions.reset({
					index: 0,
					routes: [{ name: "AuthStack" }],
				})
			);

			setLoading(false);
		} catch (error) {
			setLoading(false);
			console.error("❌ Error deleting user:", error);

			Alert.alert(
				"Deletion Failed",
				`Failed to delete account: ${error.message}. Please try again or contact support.`,
				[{ text: "OK" }]
			);
		}
	};

	const logOut = async () => {
		try {
			setLoading(true);

			// Sign out from Firebase
			await signOut(FIREBASE_AUTH);

			// Clear all stores
			useUserDetails.getState().clearUser();
			useDriverDetails.getState().clearDriver();
			useAuthStore.getState().clearAuth();

			// Reset navigation to AuthStack
			setModal(false);
			navigation.dispatch(
				CommonActions.reset({
					index: 0,
					routes: [{ name: "AuthStack" }],
				})
			);

			setLoading(false);
		} catch (error) {
			setLoading(false);
			console.error("Logout Error:", error);
			alert("Logout failed. Please try again.");
		}
	};

	return (
		<>
			<Modal
				visible={modal}
				style={StyleSheet.absoluteFill}
				transparent
				statusBarTranslucent
			>
				<View style={styles.modal}>
					<View style={styles.container}>
						{title === "Logout" ? (
							<Text style={styles.text}>Are you sure you want to logout</Text>
						) : (
							<Text style={styles.text}>
								Are you sure you want to permanently{"\n"} delete your Kampus
								Ride's account?
							</Text>
						)}

						<View style={styles.button}>
							<ActiveButton
								title={"Yes"}
								onPress={ToAuthScreen}
								loading={loading}
							/>
							<LoginButton title={"Cancel"} onPress={Close} />
						</View>
					</View>
				</View>
			</Modal>
		</>
	);
};

export default Confirmation1;

const styles = StyleSheet.create({
	modal: {
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		flex: 1,
	},
	text: {
		fontWeight: "regular",
		textAlign: "center",
		fontSize: 16,
		color: "black",
		marginBottom: 10,
	},
	container: {
		backgroundColor: "white",
		width: "75%",
		borderRadius: 5,
		alignItems: "center",
		paddingVertical: 64,
		justifyContent: "center",
		paddingHorizontal: 10,
	},
	button: {
		marginTop: "auto",
	},
	loadingOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		alignItems: "center",
	},
	loadingContainer: {
		backgroundColor: "white",
		borderRadius: 15,
		padding: 30,
		alignItems: "center",
		minWidth: 200,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	loadingText: {
		marginTop: 15,
		fontSize: 18,
		fontFamily: "Albert-SemiBold",
		color: "#333",
	},
	loadingSubText: {
		marginTop: 5,
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: "#666",
	},
});
