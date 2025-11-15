import { Image, Modal, StyleSheet, Text, View } from "react-native";
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
import { FIREBASE_AUTH } from "../../firebaseConfig";
import { signOut } from "firebase/auth";

const Confirmation1 = ({ modal, setModal, title }) => {
	const navigation = useNavigation();
	const { accessToken, email, setAccessToken } = useUserDetails((state) => ({
		accessToken: state.accessToken,
		email: state.email,
		setAccessToken: state.setAccessToken,
	}));
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

	const deleteUser = async () => {
		setLoading(true);
		const header = {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		};
		try {
			const response = await axios.delete(
				`${API.DeleteProfile}/${email}`,
				header
			);
			console.log(response?.data);
			setLoading(false);
		} catch (e) {
			setLoading(false);
			console.error("Error deleting user:", e);
			alert("An unknown error occurred.");
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
});
