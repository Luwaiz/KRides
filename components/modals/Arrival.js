import { Image, Modal, StyleSheet, Text, View } from "react-native";
import React from "react";
import ActiveButton from "../buttons/ActiveButton";
import Keke from "../../assets/svg/Keke.svg";
import { useBottomTabStore } from "../../constants/Store";

const Arrival = ({ modal, setModal }) => {
	const ToHome = useBottomTabStore((state) => state.setDriverHome);

	const Cancel = () => {
		setModal(false);
	};

	return (
		<Modal
			visible={modal}
			style={styles.cont}
			transparent
			statusBarTranslucent
			onRequestClose={() => setModal(false)}
		>
			<View style={styles.modal}>
				<View style={styles.container}>
					<Keke />
					<Text style={styles.text}>Arrived at customers location</Text>
					<View style={styles.button}>
						<ActiveButton title={"OK"} onPress={ToHome} />
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
		fontWeight: "regular",
		textAlign: "center",
		fontSize: 16,
		color: "black",
		marginVertical: 10,
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
