import {
	Modal,
	StyleSheet,
	Text,
	View,
	Alert,
	ActivityIndicator,
	TextInput,
} from "react-native";
import React, { useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import { useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
import useAuthStore, {
	useDriverDetails,
	useUserDetails,
} from "../../constants/Store";
import { FIREBASE_AUTH, FIREBASE_DB } from "../../firebaseConfig";
import {
	signOut,
	deleteUser as firebaseDeleteUser,
	reauthenticateWithCredential,
	GoogleAuthProvider,
	EmailAuthProvider,
} from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { doc, deleteDoc } from "firebase/firestore";
import Toast from "react-native-toast-message";
import { colors } from "../../constants/styling";
import notificationManager from "../../helpers/notificationManager";

const Confirmation1 = ({ modal, setModal, title }) => {
	const navigation = useNavigation();
	const { email } = useUserDetails((state) => ({ email: state.email }));
	const [loading, setLoading] = useState(false);
	const [passwordPrompt, setPasswordPrompt] = useState(false);
	const [passwordInput, setPasswordInput] = useState("");

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

	const reauthenticate = async (currentUser, password = null) => {
		const providers = currentUser.providerData.map((p) => p.providerId);
		if (providers.includes("google.com")) {
			await GoogleSignin.hasPlayServices();
			const response = await GoogleSignin.signIn();
			const idToken = response.idToken || response.data?.idToken;
			const credential = GoogleAuthProvider.credential(idToken);
			await reauthenticateWithCredential(currentUser, credential);
		} else {
			if (!password) throw new Error("PASSWORD_NEEDED");
			const credential = EmailAuthProvider.credential(currentUser.email, password);
			await reauthenticateWithCredential(currentUser, credential);
		}
	};

	const performDeletion = async (password = null) => {
		setLoading(true);
		setPasswordPrompt(false);
		try {
			const currentUser = FIREBASE_AUTH.currentUser;
			if (!currentUser) {
				Alert.alert("Error", "No user is currently logged in.");
				return;
			}

			const { role } = useAuthStore.getState();
			const collectionName = role === "driver" ? "drivers" : "users";

			// Step 1: Delete Firebase Auth user (may need reauthentication)
			try {
				await firebaseDeleteUser(currentUser);
			} catch (authError) {
				if (authError.code === "auth/requires-recent-login") {
					try {
						await reauthenticate(currentUser, password);
						await firebaseDeleteUser(currentUser);
					} catch (reauthError) {
						if (reauthError.message === "PASSWORD_NEEDED") {
							setLoading(false);
							setPasswordInput("");
							setPasswordPrompt(true);
							return;
						}
						throw reauthError;
					}
				} else {
					throw authError;
				}
			}

			// Step 2: Delete Firestore document (only after Auth deletion succeeds)
			try {
				await deleteDoc(doc(FIREBASE_DB, collectionName, currentUser.uid));
			} catch (e) {
				// Non-fatal — auth account is already gone
			}

			// Step 3: Clear stores and navigate
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

	const deleteUser = () => performDeletion(null);

	const logOut = async () => {
		try {
			setLoading(true);

			// Clear this device's push token from Firestore while still
			// authenticated — otherwise the next person to log into this
			// device could receive push notifications meant for this account.
			const currentUser = FIREBASE_AUTH.currentUser;
			if (currentUser) {
				const { role } = useAuthStore.getState();
				await notificationManager.cleanup(currentUser.uid, role);
			}

			// Sign out from Firebase
			await signOut(FIREBASE_AUTH);

			// Clear all stores
			useUserDetails.getState().clearUser();
			useDriverDetails.getState().clearDriver();
			useAuthStore.getState().clearAuth();

			// onAuthStateChanged in Navigation.js handles routing automatically
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

			{/* Password re-entry for email users */}
			{passwordPrompt && (
				<Modal visible transparent statusBarTranslucent animationType="fade">
					<View style={styles.modal}>
						<View style={styles.container}>
							<Text style={styles.text}>Enter your password to confirm deletion</Text>
							<TextInput
								style={styles.passwordInput}
								placeholder="Password"
								secureTextEntry
								value={passwordInput}
								onChangeText={setPasswordInput}
								autoFocus
							/>
							<View style={styles.button}>
								<ActiveButton title={"Confirm"} onPress={() => performDeletion(passwordInput)} disabled={!passwordInput} />
								<LoginButton title={"Cancel"} onPress={() => { setPasswordPrompt(false); setPasswordInput(""); }} />
							</View>
						</View>
					</View>
				</Modal>
			)}

			{/* Loading Overlay */}
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
	passwordInput: {
		width: "100%",
		borderWidth: 1,
		borderColor: colors.lightGrey,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
		marginVertical: 16,
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
