import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import GoogleButton from "../../components/buttons/GoogleButton";
import Terms from "../../components/Terms";
import BackButton from "../../components/buttons/BackButton";
import Firebase from "../../hooks/Firebase";
import Toast from "react-native-toast-message";

const Signup = ({ navigation }) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [phone, setPhone] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const isPasswordValid = (password) => {
		return password.length >= 8;
	};

	const isPasswordMatched = (password, confirmPassword) => {
		return password === confirmPassword;
	};

	const isPhoneValid = (phone) => {
		// Check if phone is exactly 11 digits
		const phoneRegex = /^\d{11}$/;
		return phoneRegex.test(phone);
	};

	const isEmailValid = (email) => {
		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const handleSignUp = async () => {
		if (
			!firstName ||
			!lastName ||
			!email ||
			!phone ||
			!password ||
			!confirmPassword
		) {
			Alert.alert("Missing Fields", "Please fill in all fields");
			return;
		}

		if (!isPasswordValid(password)) {
			Alert.alert("Weak Password", "Password must be at least 8 characters.");
			return;
		}

		if (!isPasswordMatched(password, confirmPassword)) {
			Alert.alert("Password Mismatch", "Passwords do not match.");
			return;
		}

		if (!isPhoneValid(phone)) {
			Alert.alert(
				"Invalid Phone Number",
				"Phone number must be exactly 11 digits (e.g., 08123456789)"
			);
			return;
		}

		if (!isEmailValid(email)) {
			Alert.alert(
				"Invalid Email",
				"Please enter a valid email address (e.g., johndoe@gmail.com)"
			);
			return;
		}

		setLoading(true);
		try {
			console.log("🚀 Starting customer signup process...");

			// Use Firebase Auth to create user and Firestore user doc
			const user = await Firebase.signUpWithEmail({
				email,
				password,
				name: `${firstName} ${lastName}`.trim(),
				phone,
				role: "customer",
			});

			console.log("✅ Customer signup success:", user.uid);

			try {
				// Register FCM token for notifications
				await Firebase.registerFcmToken(user.uid);
				console.log("✅ FCM token registered");
			} catch (fcmError) {
				// Don't fail signup if FCM registration fails
				console.warn("⚠️ FCM token registration failed:", fcmError);
			}

			Toast.show({
				type: "tomatoToast",
				text1: "Account Created!",
				text2: "Welcome to KRides",
				position: "top",
				visibilityTime: 2000,
			});

			// Don't setLoading(false) here - let Navigation handle the transition
			// Navigation.js will automatically route to customer home
			// No need to manually navigate
		} catch (error) {
			setLoading(false);
			console.error("❌ Customer signup error:", error);

			let errorMessage = "Sign up failed. Please try again.";
			if (error.code === "auth/email-already-in-use") {
				errorMessage =
					"This email is already registered. Please login instead.";
			} else if (error.code === "auth/invalid-email") {
				errorMessage = "Invalid email address";
			} else if (error.code === "auth/weak-password") {
				errorMessage = "Password is too weak";
			}

			Alert.alert("Sign Up Failed", errorMessage);
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
								text={"First Name"}
								placeholder={"John"}
								onChangeText={(text) => setFirstName(text)}
								value={firstName}
							/>
							<TextInput1
								text={"Last Name"}
								placeholder={"Doe"}
								onChangeText={(text) => setLastName(text)}
								value={lastName}
							/>
							<TextInput1
								text={"Email Address"}
								placeholder={"johndoe22@gmail.com"}
								onChangeText={(text) => setEmail(text)}
								value={email}
								keyboardType="email-address"
								autoCapitalize="none"
							/>
							<TextInput1
								text={"Phone Number"}
								placeholder={"08123456789"}
								onChangeText={(text) => setPhone(text)}
								value={phone}
								keyboardType="phone-pad"
							/>
							<TextInput1
								text={"Password"}
								placeholder={"*************"}
								password
								onChangeText={(text) => setPassword(text)}
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
								onPress={handleSignUp}
								disabled={
									!email ||
									!password ||
									!confirmPassword ||
									!firstName ||
									!lastName ||
									!phone ||
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

export default Signup;

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
