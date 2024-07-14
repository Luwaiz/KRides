import { Dimensions, Image, Modal, StyleSheet, Text, View } from "react-native";
import React from "react";
import ActiveButton from "../buttons/ActiveButton";
import LoginButton from "../buttons/LoginButton";
import { useBottomTabStore } from "../../constants/Store";
const { width, height } = Dimensions.get("screen");

const Confirmation2 = ({ modal, setModal }) => {
    const ToHome = useBottomTabStore((state)=>state.setHomePage)

	const Cancel = () => {
		setModal(false);
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
					<Text style={styles.text}>
						Are you sure you want to cancel the ride?
					</Text>

					<View style={styles.button}>
						<ActiveButton title={"Yes"} onPress={ToHome}/>
						<LoginButton title={"Cancel"} onPress={Cancel}/>
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default Confirmation2;

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
	},
	button: {
		marginTop: "auto",
	},
});
