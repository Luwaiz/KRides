import { Dimensions, Image, Modal, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import { CommonActions, useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
import { useUserDetails } from "../../constants/Store";
import axios from "axios";
import API from "../../hooks/API";
const { width, height } = Dimensions.get("screen");

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
		navigation.dispatch(
			CommonActions.reset({
				index: 0,
				routes: [{ name: "AuthStack" }],
			})
		);
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
		console.log("Log Out", accessToken);
		setLoading(true);
		const header = {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		};
		try {
			const response = await axios.post(API.LogOut, header);
			console.log(response?.data);
			setAccessToken("");
			setLoading(false);
		} catch (e) {
			setLoading(false);
			console.error("Error deleting token:", e?.response?.data);
			alert("An unknown error occurred.");
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
		width: width / 1.4,
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
