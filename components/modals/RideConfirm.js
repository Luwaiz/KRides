import { Dimensions, Image, Modal, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import Keke from "../../assets/svg/Keke.svg";

import InActiveButton from "../buttons/InActiveButton";

import { useNavigation } from "@react-navigation/native";
import LoginButton from "../buttons/LoginButton";
import Confirmation2 from "./Confirmation2";
import Toast from "react-native-toast-message";
const { width, height } = Dimensions.get("screen");

const RideConfirm = ({ modal, setModal }) => {
	const navigation = useNavigation();
	const [cancel, setCancel] = useState(false);

	const cancelRide = () => {
		setCancel(true);
	};
	const showToast = () => {
		setModal(false);
		Toast.show({
			text1: "Tobi, Your rider will be here in",
			text1Style: styles.toastText1,
			type: "tomatoToast",
			text2: "2 minutes",
			text2Style: styles.toastText2,
			autoHide: false,
			onHide: () => cancelRide(),
		});
	};
	return (
		<>
			<Modal
				visible={modal}
				style={styles.modalCont}
				transparent
				statusBarTranslucent
				onRequestClose={() => setModal(false)}
			>
				<View style={styles.modal}>
					<View style={styles.container}>
						<Keke />
						<Text style={styles.text1}>Ride has been accepted</Text>
						<Text style={styles.text2}>Henry Ade</Text>
						<View style={styles.button}>
							<ActiveButton title={"Proceed"} onPress={showToast} />
							<LoginButton title={"Cancel Ride"} onPress={cancelRide} />
						</View>
					</View>
				</View>
			</Modal>
			<Confirmation2 modal={cancel} setModal={setCancel} />
		</>
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
