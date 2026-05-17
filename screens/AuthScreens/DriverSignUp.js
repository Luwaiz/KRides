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
		// Accept 11-digit local format or international +234 format
		const phoneRegex = /^\+?\d{7,15}$/;
		return phoneRegex.test(phone.replace(/\s/g, ""));
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
		return (
			password.length >= 8 &&
			/[A-Z]/.test(password) &&
			/[0-9]/.test(password) &&
			/[^A-Za-z0-9]/.test(password)
		);
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
				"Enter a valid phone number (e.g., 08123456789 or +2348123456789) 📞"
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
				"Password must be at least 8 characters and include an uppercase letter, a number, and a special character (e.g. @, #, !)."
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

		try {
			if (!validateForm()) {
				setLoading(false);
				return;
			}

			const normalizedPhone = Firebase.normalizeNigerianPhone(phone);
			if (!normalizedPhone) {
				setLoading(false);
				Alert.alert("Invalid Phone Number", "Please enter a valid Nigerian phone number (e.g. 08012345678).");
				return;
			}

			// Set pending_role BEFORE auth fires so Navigation.js routes as driver
			// even if the Firestore driver doc hasn't been written yet.
			// Include expiry so a crash mid-signup doesn't permanently misroute logins.
			await AsyncStorage.setItem('pending_role', JSON.stringify({ role: 'driver', expiresAt: Date.now() + 5 * 60 * 1000 }));

			const user = await Firebase.signUpDriver({
				email,
				phone: normalizedPhone,
				password,
				fullname: fullName,
				vehicle_id,
			});

			console.log("✅ Driver account created:", user.uid);

			setFullName(fullName);
			setVehicleId(vehicle_id);
			setPhone(normalizedPhone);

			await Firebase.registerFcmToken(user.uid);

			setLoading(false);
			navigation.replace("BankAccountDetails");
		} catch (error) {
			console.error("❌ Driver signup error:", error.code, error.message);
			setLoading(false);
			// Clear pending_role so a failed signup doesn't misroute the next login attempt
			await AsyncStorage.removeItem('pending_role').catch(() => {});
			if (error.code === "auth/email-already-in-use") {
				Alert.alert("Already Registered", "An account with this email already exists. Please login instead.");
			} else if (error.code === "auth/weak-password") {
				Alert.alert("Weak Password", "Please choose a stronger password.");
			} else {
				Alert.alert("Sign Up Failed", error.message || "Registration failed. Please try again.");
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
	bottomCont: {
		backgroundColor: colors.secondary,
		width: "100%",
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		flex: 1,
		// minHeight: 500, // Ensure minimum height to cover screen
	},
});
