import {
	Modal,
	StyleSheet,
	Text,
	View,
	Alert,
	ActivityIndicator,
} from "react-native";
import React, { useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import { useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
import useAuthStore, {
	useDriverDetails,
	useUserDetails,
} from "../../constants/Store";
import { FIREBASE_AUTH } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import Toast from "react-native-toast-message";
import { colors } from "../../constants/styling";
import notificationManager from "../../helpers/notificationManager";
import { NOTIFICATION_API_KEY } from "@env";
import { wp } from "../../constants/responsive";

const SERVER_URL = 'https://krides.onrender.com/api';

const Confirmation1 = ({ modal, setModal, title }) => {
	const navigation = useNavigation();
	const { email } = useUserDetails((state) => ({ email: state.email }));
	const [loading, setLoading] = useState(false);

	const ToAuthScreen = () => {
		setModal(false);
		if (title === "Logout") {
			logOut();
		} else {
			deleteUser();
		}
	};
	const Close = () => {
		setModal(false);
	};

	const performDeletion = async () => {
		setLoading(true);
		try {
			const currentUser = FIREBASE_AUTH.currentUser;
			if (!currentUser) {
				Alert.alert("Error", "No user is currently logged in.");
				return;
			}

			const idToken = await currentUser.getIdToken();

			const response = await fetch(`${SERVER_URL}/account/delete`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": NOTIFICATION_API_KEY || "",
					"Authorization": `Bearer ${idToken}`,
				},
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) {
				throw new Error(result.error || "Could not delete account");
			}

			useUserDetails.getState().clearUser();
			useDriverDetails.getState().clearDriver();
			useAuthStore.getState().clearAuth();

			Toast.show({
				type: "tomatoToast",
				text1: "Account Deleted",
				text2: "Your account has been permanently deleted",
				position: "top",
				visibilityTime: 5000,
			});

			setModal(false);
		} catch (error) {
			console.error("❌ Error deleting account:", error);
			Alert.alert("Deletion Failed", error.message || "Please try again or contact support.");
		} finally {
			setLoading(false);
		}
	};

	const deleteUser = () => performDeletion();

	const logOut = async () => {
		try {
			setLoading(true);

			const currentUser = FIREBASE_AUTH.currentUser;
			if (currentUser) {
				const { role } = useAuthStore.getState();
				await notificationManager.cleanup(currentUser.uid, role);
			}

			await signOut(FIREBASE_AUTH);

			useUserDetails.getState().clearUser();
			useDriverDetails.getState().clearDriver();
			useAuthStore.getState().clearAuth();

			setLoading(false);
		} catch (error) {
			setLoading(false);
			console.error("Logout Error:", error);
			Alert.alert("Logout Failed", "Logout failed. Please try again.");
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

			{}
			{loading && (
				<Modal
					visible={loading}
					transparent
					statusBarTranslucent
					animationType="fade"
				>
					<View style={styles.loadingOverlay}>
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={colors.primaryBlue} />
							<Text style={styles.loadingText}>
								{title === "Logout" ? "Logging out..." : "Deleting account..."}
							</Text>
							<Text style={styles.loadingSubText}>Please wait</Text>
						</View>
					</View>
				</Modal>
			)}
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
		width: wp(281),
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
