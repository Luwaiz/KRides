import { StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import ActiveButton from "../../components/buttons/ActiveButton";
import SuccessNo from "../../components/modals/SuccessNo";
import TextInput1 from "../../components/TextInput1";
import axios from "axios";
import API from "../../hooks/API";

const ForgetPass = ({ navigation }) => {
	const [modal, setModal] = useState(false);
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const ModalVisible = () => {
		setModal(true);
	};

	const requestCode = async () => {
		setLoading(true);
		const request = {
			email: email,
		};
		try {
			const response = await axios.post(API.ChangePassword, request);
			console.log("Reset Code Response:", response?.data);
            console.log("Email:", response?.data?.message);
			if (response?.data?.message === "Password reset link sent.") {
				navigation.goBack();
			}
			setLoading(false);
		} catch (error) {
			console.log("Error requesting reset code:", error.message);
			setLoading(false);
		}
	};
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton
					text={<Text style={styles.headText}>Reset Password</Text>}
				/>
			</View>
			<View style={styles.infoCont}>
				<Text style={styles.infoText1}>
					Enter your registered email to receive a reset code
				</Text>
			</View>
			<View style={styles.bottomCont}>
				<TextInput1 onChangeText={(text) => setEmail(text)} />
				<Text style={styles.infoText3}>I haven’t received a code (1:27)</Text>
				<View style={styles.button}>
					<ActiveButton
						title={"Continue"}
						onPress={() => requestCode()}
						loading={loading}
					/>
					{modal && <SuccessNo modal={modal} setModal={setModal} />}
				</View>
			</View>
		</SafeAreaView>
	);
};
export default ForgetPass;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.secondary2,
	},
	topCont: {
		paddingTop: 26,
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	infoCont: {
		marginVertical: 16,
		paddingHorizontal: 16,
		gap: 4,
		justifyContent: "center",
	},
	infoText1: {
		color: colors.lightGrey3,
	},
	infoText2: {
		color: "black",
		fontWeight: "bold",
		fontSize: 16,
	},
	infoText3: {
		color: colors.primaryBlue,
	},
	bottomCont: {
		flex: 1,
		paddingHorizontal: 16,
	},
	inputCont: {
		justifyContent: "space-between",
		marginBottom: 14,
	},
	codeCont: {
		width: 72,
		height: 72,
		borderWidth: 1,
		backgroundColor: colors.lightGrey2,
	},
	focused: {
		borderColor: colors.primaryBlue,
	},
	focusStick: {
		display: "none",
	},
	pinCodeText: {
		fontWeight: "bold",
		fontSize: 24,
	},
	button: {
		marginTop: "auto",
		marginBottom: 16,
	},
});
