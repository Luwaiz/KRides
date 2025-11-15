import { Image, Modal, StyleSheet, Text, View } from "react-native";
import React from "react";
import ActiveButton from "../buttons/ActiveButton";

const UnSuccessNo = ({ modal, setModal }) => {
	return (
		<Modal
			visible={modal}
			style={styles.modalCont}
			transparent
			statusBarTranslucent
		>
			<View style={styles.modal}>
				<View style={styles.container}>
					<View style={styles.icon}>
						<Image
							source={require("../../assets/images/Vectorunsucces.png")}
							resizeMode="contain"
						/>
					</View>
					<Text style={styles.text}>
						No account found{"\n"}Please try again and contact help@kampusriders
					</Text>
					<View style={styles.button}>
						<ActiveButton title={"OK"} onPress={() => setModal(false)} />
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default UnSuccessNo;

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
		marginBottom: 20,
	},
	container: {
		backgroundColor: "white",
		width: "75%",
		borderRadius: 5,
		alignItems: "center",
		padding: 24,
	},
	icon: {
		width: 110,
		height: 110,
		justifyContent: "center",
		alignItems: "center",
	},
	button: {
		marginTop: "auto",
	},
});
