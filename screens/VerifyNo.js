import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { OtpInput } from "react-native-otp-entry";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/styling";
import BackButton from "../components/buttons/BackButton";
import ActiveButton from "../components/buttons/ActiveButton";

const VerifyNo = () => {
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton text={<Text style={styles.headText}>Verify Number</Text>} />
			</View>
			<View style={styles.infoCont}>
				<Text style={styles.infoText1}>A code was sent to</Text>
				<Text style={styles.infoText2}>08123456789</Text>
				<Text style={styles.infoText3}>Edit phone number</Text>
			</View>
			<View style={styles.bottomCont}>
				<OtpInput
					numberOfDigits={4}
					theme={{
						containerStyle: styles.inputCont,
						pinCodeContainerStyle: styles.codeCont,
						focusedPinCodeContainerStyle: styles.focused,
						focusStickStyle: styles.focusStick,
						pinCodeTextStyle: styles.pinCodeText,
					}}
				/>
				<Text style={styles.infoText3}>I haven’t received a code (1:27)</Text>
                <View style={styles.button}>
                <ActiveButton title={"Verify Number"} />
                </View>
			</View>
		</SafeAreaView>
	);
};

export default VerifyNo;

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
		fontWeight: "700",
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
		borderColor: "white",
		justifyContent: "center",
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
	infoCont: {
		marginVertical: 14,
		height: 80,
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
    button: {
        width:"100",
        marginTop:"auto",
        marginBottom:16
    }
});
