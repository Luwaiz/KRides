import { StyleSheet, Text, View, Alert } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import ActiveButton from "../../components/buttons/ActiveButton";
import SuccessNo from "../../components/modals/SuccessNo";
import TextInput1 from "../../components/TextInput1";
import { FIREBASE_AUTH } from "../../firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";
import Toast from "react-native-toast-message";

const ForgetPass = ({ navigation }) => {
	const [modal, setModal] = useState(false);
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const ModalVisible = () => {
		setModal(true);
	};

	const requestCode = async () => {
		if (!email) {
			Alert.alert("Error", "Please enter your email address or phone number");
			return;
		}

		setLoading(true);
		try {
			let emailToUse = email.trim();

			// Check if input is a phone number (11 digits)
			const phoneRegex = /^\d{11}$/;
			if (phoneRegex.test(emailToUse)) {
				// Convert phone to driver email format
				emailToUse = `${emailToUse}@rideapp.com`;
				console.log("🔐 Converted phone number to driver email:", emailToUse);
			} else {
				// Validate email format
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!emailRegex.test(emailToUse)) {
					Alert.alert(
						"Invalid Input",
						"Please enter a valid email address or 11-digit phone number"
					);
					setLoading(false);
					return;
				}
			}

			console.log("🔐 Sending password reset email to:", emailToUse);

			// Send password reset email
			await sendPasswordResetEmail(FIREBASE_AUTH, emailToUse);

			console.log("✅ Password reset email sent successfully");

			Toast.show({
				type: "tomatoToast",
				text1: "Reset Email Sent",
				text2: "Check your inbox (and spam folder) for the reset link",
				position: "top",
				visibilityTime: 5000,
			});

			// Navigate back to login after a short delay
			setTimeout(() => {
				navigation.goBack();
			}, 2000);

			setLoading(false);
		} catch (error) {
			console.error("❌ Error sending password reset email:", error);
			setLoading(false);

			let errorMessage = "Failed to send reset email. Please try again.";

			if (error.code === "auth/user-not-found") {
				errorMessage = "No account found with this email or phone number";
			} else if (error.code === "auth/invalid-email") {
				errorMessage = "Invalid email address";
			} else if (error.code === "auth/too-many-requests") {
				errorMessage = "Too many requests. Please try again later.";
			}

			Alert.alert("Reset Failed", errorMessage);
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
					Enter your registered email address or phone number to receive a password reset link
				</Text>
				<Text style={styles.infoText2}>
					Note: Drivers can use their 11-digit phone number. Check your spam/junk folder if you don't see the email.
				</Text>
			</View>
			<View style={styles.bottomCont}>
				<TextInput1
					onChangeText={(text) => setEmail(text)}
					value={email}
					placeholder="email@example.com or 08123456789"
					keyboardType="default"
					autoCapitalize="none"
					text="Email or Phone Number"
				/>
				<View style={styles.button}>
					<ActiveButton
						title={"Send Reset Link"}
						onPress={() => requestCode()}
						loading={loading}
					/>
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
		fontSize: 15,
	},
	infoText2: {
		color: colors.primaryBlue,
		fontSize: 13,
		marginTop: 8,
		fontFamily: "Albert-Medium",
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
