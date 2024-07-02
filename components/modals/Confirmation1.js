import { Dimensions, Image, Modal, StyleSheet, Text, View } from "react-native";
import React from "react";
import ActiveButton from "../buttons/ActiveButton";
import InActiveButton from "../buttons/InActiveButton";

import { useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
const { width, height } = Dimensions.get("screen");

const Confirmation1 = ({ modal, setModal, title }) => {
	const navigation = useNavigation();
	const ToAuthScreen = () => {
		setModal(false);
		navigation.navigate("AuthStack", {
			params: title === "Logout" ? "Login" : "Signup",
		});
	};
	const ToName = () => {
		setModal(false);
	};
	return (
		<Modal
			visible={modal}
			style={styles.modalCont}
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
							Riders account?
						</Text>
					)}

					<View style={styles.button}>
						<ActiveButton title={"Yes"} onPress={ToAuthScreen} />
						<LoginButton title={"Cancel"} onPress={ToName} />
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default Confirmation1;

const styles = StyleSheet.create({
	modalCont: {
		flex: 1,
	},
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
	},
	button: {
		marginTop: "auto",
	},
});
