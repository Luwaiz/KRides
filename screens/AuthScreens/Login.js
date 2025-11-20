import { Dimensions, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import GoogleButton from "../../components/buttons/GoogleButton";
import Terms from "../../components/Terms";
import BackButton from "../../components/buttons/BackButton";
import Firebase from "../../hooks/Firebase";
import Toast from "react-native-toast-message";
const {height,width} = Dimensions.get('window');

const Login = ({ navigation }) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleLogin = async () => {
		if (!email || !password) {
			alert("Please enter both email and password");
			return;
		}

		setLoading(true);
		try {
			await Firebase.signInWithEmail(email, password);
			// Navigation.js will automatically handle routing based on Firebase Auth
			Toast.show({
				type: "tomatoToast",
				text1: "Login Successful",
				text2: "Welcome back!",
				position: "top",
				visibilityTime: 2000,
			});
		} catch (error) {
			setLoading(false);
			console.log("Login Error:", error);

			let errorMessage = "Login failed. Please try again.";
			if (
				error.code === "auth/invalid-credential" ||
				error.code === "auth/wrong-password"
			) {
				errorMessage = "Invalid email or password";
			} else if (error.code === "auth/user-not-found") {
				errorMessage = "No account found with this email";
			} else if (error.code === "auth/invalid-email") {
				errorMessage = "Invalid email address";
			} else if (error.code === "auth/too-many-requests") {
				errorMessage = "Too many failed attempts. Please try again later.";
			}

			alert(errorMessage);
		}
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton text={<Text style={styles.headText}>Login</Text>} />
			</View>
			<View style={styles.bottomCont}>
				<View style={styles.sheetCont}>
					<View style={styles.textInputCont}>
						<TextInput1
							text={"Email Address"}
							placeholder={"johndoe22@gmail.com"}
							onChangeText={(text) => setEmail(text)}
							value={email}
							keyboardType="email-address"
							autoCapitalize="none"
						/>
						<TextInput1
							text={"Password"}
							placeholder={"*************"}
							password
							onChangeText={(text) => setPassword(text)}
							value={password}
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
									onPress={handleLogin}
								/>
							</View>
						</View>
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
		</SafeAreaView>
	);
};

export default Login;

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
	logInButton: {
		width: "100%",
	},
	buttons: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
});
