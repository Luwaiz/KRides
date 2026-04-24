import { Image, Modal, StyleSheet, Text, View } from "react-native";
import React from "react";
import ActiveButton from "../buttons/ActiveButton";
import Keke from "../../assets/svg/Keke.svg";

const Arrival = ({ modal, setModal, onDismiss }) => {
	const handleOK = () => {
		setModal(false);
		onDismiss?.();
	};

	return (
		<Modal
			visible={modal}
			style={styles.cont}
			transparent
			statusBarTranslucent
			onRequestClose={handleOK}
		>
			<View style={styles.modal}>
				<View style={styles.container}>
					<Keke />
					<Text style={styles.text}>Ride Completed!</Text>
					<Text style={styles.subText}>Your earnings have been recorded.</Text>
					<View style={styles.button}>
						<ActiveButton title={"OK"} onPress={handleOK} />
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default Arrival;

const styles = StyleSheet.create({
	cont: {
		flex: 1,
		backgroundColor: "white",
		width: "75%",
		borderRadius: 5,
		alignItems: "center",
		paddingVertical: 64,
	},
	modal: {
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		flex: 1,
	},
	text: {
		fontWeight: "700",
		textAlign: "center",
		fontSize: 18,
		color: "black",
		marginVertical: 10,
	},
	subText: {
		fontSize: 14,
		color: "#666",
		textAlign: "center",
		marginBottom: 8,
	},
	container: {
		backgroundColor: "white",
		width: "75%",
		borderRadius: 5,
		alignItems: "center",
		paddingVertical: 64,
		justifyContent: "center",
	},
	button: {
		marginTop: "auto",
	},
});
