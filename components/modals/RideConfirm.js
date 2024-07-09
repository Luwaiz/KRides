import { Dimensions, Image, Modal, StyleSheet, Text, View } from "react-native";
import React from "react";
import ActiveButton from "../buttons/ActiveButton";
import Keke from "../../assets/svg/Keke.svg";

import InActiveButton from "../buttons/InActiveButton";

import { useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
const { width, height } = Dimensions.get("screen");

const RideConfirm = ({ modal, setModal }) => {
	const navigation = useNavigation();

	const ToAuthScreen = () => {
		setModal(false);
    
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
					<Keke />
					<Text style={styles.text1}>Ride has been accepted</Text>
                    <Text style={styles.text2}>Henry Ade</Text>

					<View style={styles.button}>
						<ActiveButton title={"Proceed"} onPress={ToAuthScreen} />
						<LoginButton title={"Cancel Ride"} onPress={ToName} />
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default RideConfirm;

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
	text1: {
		fontFamily: "Albert-Regular",
		textAlign: "center",
		fontSize: 16,
		color: "black",
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
    text2: {
		fontFamily: "Albert-SemiBold",
		textAlign: "center",
		fontSize: 16,
        marginBottom: 10,
	},
});
