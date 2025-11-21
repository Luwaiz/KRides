import { ScrollView, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import GoogleButton from "../../components/buttons/GoogleButton";
import Terms from "../../components/Terms";
import BackButton from "../../components/buttons/BackButton";
import { useDriverDetails } from "../../constants/Store";
import Firebase from "../../hooks/Firebase";

const DriverSignup = ({ navigation }) => {
	const [vehicle_id, setVehicle_id] = useState("");
	const [password, setPass] = useState("");
	const [phone, setPhoneNumber] = useState("");
	const [fullName, setFull] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const { setVehicleId, setPhone, setFullName } = useDriverDetails((state) => ({
		setVehicleId: state.setVehicleId,
		setPhone: state.setPhone,
		setFullName: state.setFullName,
	}));

	const validateForm = () => {
		if (!fullName || !vehicle_id || !phone || !password || !confirmPassword) {
			alert("Please fill in all fields");
			return false;
		}

		if (password !== confirmPassword) {
			alert("Passwords do not match");
			return false;
		}

		return true;
	};

	const handleSignUp = async (password, confirmPassword) => {
		setLoading(true);

		// Simple validation
		if (!validateForm()) {
			setLoading(false);
			return;
		}

		try {
			const user = await Firebase.signUpDriver({
				phone,
				password,
				fullname: fullName,
				vehicle_id,
			});

			// Update local state with the user info
			setFullName(fullName);
			setVehicleId(vehicle_id);
			setPhone(phone);

			// Register FCM token for notifications
			await Firebase.registerFcmToken(user.uid);

			setLoading(false);

			// Navigate to bank account details
			navigation.replace("BankAccountDetails");
		} catch (error) {
			console.error("Error registering driver:", error);
			setLoading(false);
			if (error.code === "auth/email-already-in-use") {
				alert("A driver with this phone number is already registered.");
			} else if (error.code === "auth/weak-password") {
				alert("Please choose a stronger password.");
			} else {
				alert(error.message || "Registration failed. Please try again.");
			}
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView style={{ flex: 1 }}>
				<View style={styles.topCont}>
					<BackButton text={<Text style={styles.headText}>Sign Up</Text>} />
				</View>
				<View style={styles.bottomCont}>
					<View style={styles.sheetCont}>
						<View style={styles.textInputCont}>
							<TextInput1
								text={"Full Name"}
								placeholder={"John Doe"}
								onChangeText={(text) => setFull(text)}
							/>
							<TextInput1
								text={"Vehicle Id"}
								placeholder={"e.g Z9"}
								onChangeText={(text) => setVehicle_id(text)}
							/>
							<TextInput1
								text={"Phone Number"}
								placeholder={"08123456789"}
								onChangeText={(text) => setPhoneNumber(text)}
							/>
							<TextInput1
								text={"Password"}
								placeholder={"*************"}
								password
								onChangeText={(text) => setPass(text)}
							/>
							<TextInput1
								text={"Confirm Password"}
								placeholder={"*************"}
								password
								onChangeText={(text) => setConfirmPassword(text)}
							/>
							<ActiveButton
								title={"Sign up"}
								onPress={() => handleSignUp(password, confirmPassword)}
								disabled={
									phone === "" ||
									vehicle_id === "" ||
									password === "" ||
									confirmPassword === "" ||
									loading
								}
								loading={loading}
							/>
							<View style={styles.OrContainer}>
								<View style={styles.dash} />
								<Text style={styles.OrText}>OR</Text>
								<View style={styles.dash} />
							</View>
							<GoogleButton title={"Continue with Google"} />
						</View>
					</View>
					<Terms />
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

export default DriverSignup;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.primaryBlue,
	},
	topCont: {
		flex: 1,
		backgroundColor: colors.primaryBlue,
		paddingTop: 26,
	},
	headText: {
		color: colors.secondary,
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	sheetCont: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 50,
		alignItems: "center",
	},
	textInputCont: {
		width: "100%",
		flex: 1,
	},
	OrContainer: {
		flexDirection: "row",
		alignItems: "center",
		width: "100%",
		height: 40,
		justifyContent: "space-between",
	},
	dash: {
		width: "47%",
		height: 1,
		backgroundColor: "black",
	},
	OrText: {
		color: "black",
		fontSize: 16,
		fontWeight: "700",
	},
	bottomCont: {
		backgroundColor: colors.secondary,
		width: "100%",
		marginTop: 20,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
	},
});
