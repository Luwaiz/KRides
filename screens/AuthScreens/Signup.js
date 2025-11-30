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
import { useGoogleAuth } from "../../hooks/useGoogleAuth";
import useAuthStore from "../../constants/Store";

const Signup = ({ navigation }) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [phone, setPhone] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const { signInWithGoogle, loading: googleLoading } = useGoogleAuth();
	const setAuthData = useAuthStore((state) => state.setAuthData);

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

	const isNameValid = (name) => {
		// Name should be at least 2 characters
		return name && name.trim().length >= 2;
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
			Alert.alert(
				"Oops! Missing Information",
				"Please fill in all the fields so we can create your account. We need your name, email, phone number, and password to get you started! 😊"
			);
			return;
		}

		// Validate first name
		if (!isNameValid(firstName)) {
			Alert.alert(
				"Oops! Invalid First Name",
				"Please enter a valid first name (at least 2 characters) 😊"
			);
			return;
		}

		// Validate last name
		if (!isNameValid(lastName)) {
			Alert.alert(
				"Oops! Invalid Last Name",
				"Please enter a valid last name (at least 2 characters) 😊"
			);
			return;
		}

		// Validate email
		if (!isEmailValid(email)) {
			Alert.alert(
				"Oops! Invalid Email",
				"Please enter a valid email address (e.g., johndoe@gmail.com) 📧"
			);
			return;
		}

		// Validate phone number
		if (!isPhoneValid(phone)) {
			Alert.alert(
				"Oops! Invalid Phone Number",
				"Phone number must be exactly 11 digits (e.g., 08123456789) 📞"
			);
			return;
		}

		if (!isPasswordValid(password)) {
			Alert.alert(
				"Weak Password",
				"Please choose a stronger password (at least 8 characters) 🔒"
			);
			return;
		}

		if (!isPasswordMatched(password, confirmPassword)) {
			Alert.alert(
				"Password Mismatch",
				"Passwords don't match. Please try again! 🔑"
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

	const handleGoogleSignIn = async () => {
		try {
			console.log('🔐 Starting Google Sign-In for customer signup...');
			const result = await signInWithGoogle('customer');

			if (result && result.user) {
				console.log('✅ Google Sign-In successful:', result.user.email);

				// Handle user creation in Firestore
				const { data: profile } = await Firebase.handleGoogleSignIn(result.user, result.googleUser, 'customer');

				// Manually update store to ensure Navigation sees us as a customer immediately
				// This prevents race conditions if the user also has a driver account
				setAuthData(result.user, profile, 'customer');

				// Navigation handled automatically by Navigation.js
				Toast.show({
					type: "tomatoToast",
					text1: "Welcome!",
					text2: `Account created with Google`,
					position: "top",
					visibilityTime: 2000,
				});
			}
		} catch (error) {
			console.error('❌ Google Sign-In Error:', error);
			Alert.alert('Sign Up Failed', error.message || 'Google Sign-In failed. Please try again.');
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
								disabled={loading}
								loading={loading}
							/>
							<View style={styles.OrContainer}>
								<View style={styles.dash} />
								<Text style={styles.OrText}>OR</Text>
								<View style={styles.dash} />
							</View>
							<GoogleButton
								title={googleLoading ? "Signing in..." : "Continue with Google"}
								onPress={handleGoogleSignIn}
							/>
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
