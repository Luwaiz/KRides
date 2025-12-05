import { ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import React, { useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import Terms from "../../components/Terms";
import BackButton from "../../components/buttons/BackButton";
import { useDriverDetails } from "../../constants/Store";
import Firebase from "../../hooks/Firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DriverSignup = ({ navigation }) => {
	const [vehicle_id, setVehicle_id] = useState("");
	const [email, setEmail] = useState("");
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

	const isPhoneValid = (phone) => {
		// Check if phone is exactly 11 digits
		const phoneRegex = /^\d{11}$/;
		return phoneRegex.test(phone);
	};

	const isNameValid = (name) => {
		// Name should be at least 2 characters
		return name && name.trim().length >= 2;
	};

	const isVehicleIdValid = (vehicleId) => {
		// Vehicle ID should not be empty
		return vehicleId && vehicleId.trim().length > 0;
	};

	const isPasswordValid = (password) => {
		return password.length >= 8;
	};

	const isEmailValid = (email) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const validateForm = () => {
		if (!fullName || !vehicle_id || !phone || !email || !password || !confirmPassword) {
			Alert.alert(
				"Oops! Missing Information",
				"Please fill in all the fields to get started. We need your name, email, vehicle ID, phone number, and password to set up your driver account! 🚗"
			);
			return false;
		}

		// Validate full name
		if (!isNameValid(fullName)) {
			Alert.alert(
				"Oops! Invalid Name",
				"Please enter a valid full name (at least 2 characters) 😊"
			);
			return false;
		}

		// Validate vehicle ID
		if (!isVehicleIdValid(vehicle_id)) {
			Alert.alert(
				"Oops! Invalid Vehicle ID",
				"Please enter a valid vehicle ID 🚗"
			);
			return false;
		}

		// Validate phone number
		if (!isPhoneValid(phone)) {
			Alert.alert(
				"Oops! Invalid Phone Number",
				"Phone number must be exactly 11 digits (e.g., 08123456789) 📞"
			);
			return false;
		}

		// Validate email
		if (!isEmailValid(email)) {
			Alert.alert(
				"Oops! Invalid Email",
				"Please enter a valid email address (e.g., johndoe@gmail.com) 📧"
			);
			return false;
		}

		// Validate password strength
		if (!isPasswordValid(password)) {
			Alert.alert(
				"Weak Password",
				"Please choose a stronger password (at least 8 characters) 🔒"
			);
			return false;
		}

		if (password !== confirmPassword) {
			Alert.alert(
				"Password Mismatch",
				"Passwords don't match. Please try again! 🔑"
			);
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
				email,
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

			// Set flag for new driver to redirect to bank details
			await AsyncStorage.setItem("isNewDriver", "true");

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
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ flexGrow: 1 }}
			>
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
								value={fullName}
							/>
							<TextInput1
								text={"Vehicle Id"}
								placeholder={"e.g Z9"}
								onChangeText={(text) => setVehicle_id(text)}
								value={vehicle_id}
							/>
							<TextInput1
								text={"Phone Number"}
								placeholder={"08123456789"}
								onChangeText={(text) => setPhoneNumber(text)}
								value={phone}
							/>
							<TextInput1
								text={"Email Address"}
								placeholder={"johndoe@gmail.com"}
								onChangeText={(text) => setEmail(text)}
								value={email}
								keyboardType="email-address"
								autoCapitalize="none"
							/>
							<TextInput1
								text={"Password"}
								placeholder={"*************"}
								password
								onChangeText={(text) => setPass(text)}
								value={password}
							/>
							<TextInput1
								text={"Confirm Password"}
								placeholder={"*************"}
								password
								onChangeText={(text) => setConfirmPassword(text)}
								value={confirmPassword}
							/>
							<ActiveButton
								title={"Sign up"}
								onPress={() => handleSignUp(password, confirmPassword)}
								disabled={loading}
								loading={loading}
							/>
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
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		flex: 1,
		// minHeight: 500, // Ensure minimum height to cover screen
	},
});
