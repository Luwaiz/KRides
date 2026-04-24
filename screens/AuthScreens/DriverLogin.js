import { Dimensions, StyleSheet, Text, View } from "react-native";
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

const { height, width } = Dimensions.get('window');

const DriverLogin = ({ navigation }) => {
	const [phone, set_phone] = useState();
	const [password, set_password] = useState();
	const [loading, setLoading] = useState(false);

	const { setAccessToken, setPhone, setFullName, setVehicleId } =
		useDriverDetails((state) => ({
			setAccessToken: state.setAccessToken,
			setPhone: state.setPhone,
			setFullName: state.setFullName,
			setVehicleId: state.setVehicleId,
		}));

	const handleLogin = async () => {
		if (!phone || !password) {
			alert("Please enter both phone number and password");
			return;
		}

		setLoading(true);
		try {
			// Look up the driver's real email from Firestore using phone number
			const email = await Firebase.getDriverEmailByPhone(phone);

			// Tell Navigation.js to treat this auth event as a driver login,
			// guarding against the stale-closure race where a previous customer
			// role is still in memory when onAuthStateChanged fires.
			await AsyncStorage.setItem('pending_role', 'driver');

			// Sign in with the real email
			await Firebase.signInWithEmail(email, password);

			// Navigation.js will automatically handle routing based on Firebase Auth
			console.log("✅ Driver logged in successfully");
		} catch (error) {
			setLoading(false);
			console.log("Login Error:", error);

			let errorMessage = "Login failed. Please try again.";
			if (
				error.code === "auth/invalid-credential" ||
				error.code === "auth/wrong-password" ||
				error.code === "auth/user-not-found" ||
				error.code === "auth/invalid-email"
			) {
				errorMessage = "Invalid phone number or password";
			} else if (error.code === "auth/too-many-requests") {
				errorMessage = "Too many failed attempts. Please try again later.";
			} else if (error.message === "No driver found with this phone number") {
				errorMessage = "Invalid phone number or password";
			}

			alert(errorMessage);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton text={<Text style={styles.headText}>Login</Text>} />
			</View>
			<View style={styles.bottomCont}>
				<View style={styles.sheetCont}>
					<View style={styles.textInputCont}>
						<TextInput1
							text={"Phone number"}
							placeholder={"08123456789 or +2348123456789"}
							onChangeText={(text) => set_phone(text)}
						/>
						<TextInput1
							text={"Password"}
							placeholder={"*************"}
							password
							onChangeText={(text) => set_password(text)}
						/>
						<Text
							style={styles.forgot}
							onPress={() => navigation.navigate("ForgetPass")}
						>
							Forgot password?
						</Text>
						<View style={styles.buttons}>
							<View style={styles.logInButton}>
								<ActiveButton
									title={"Login"}
									loading={loading}
									onPress={() => handleLogin()}
								/>
							</View>
						</View>
					</View>
				</View>
				<Terms />
			</View>
		</SafeAreaView>
	);
};

export default DriverLogin;

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
	bottomCont: {
		backgroundColor: colors.secondary,
		width: width,
		marginTop: 20,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		height: height - 100,
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
	forgot: {
		alignSelf: "flex-end",
		marginTop: -10,
		marginBottom: 16,
	},
	logInButton: {
		width: "100%",
	},
	buttons: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
});
