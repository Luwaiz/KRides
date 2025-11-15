import { Modal, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import Keke from "../../assets/svg/Keke.svg";
import Toast from "react-native-toast-message";
import { useBottomTabStore, useRideStore } from "../../constants/Store";

const RideConfirm = ({ modal, setModal, driverName }) => {
	const [cancel, setCancel] = useState(false);
	const ToHome = useBottomTabStore((state) => state.setHomePage);
	const setLocation = useRideStore((state) => state.setLocation);
	const setDestination = useRideStore((state) => state.setDestination);

	const cancelRide = () => {
		setCancel(true);
	};

	const showToast = () => {
		setModal(false);
		setLocation("");
		setDestination("");
		ToHome();
		Toast.show({
			text1: `${driverName}, Your rider will be here in`,
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
						<Text style={styles.text1}>Ride has been accepted by </Text>
						<Text style={styles.text2}>{driverName}</Text>
						<View style={styles.button}>
							<ActiveButton title={"Proceed"} onPress={showToast} />
						</View>
					</View>
				</View>
			</Modal>
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
		width: "75%",
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
