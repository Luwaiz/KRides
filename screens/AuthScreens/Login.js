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
import BiometricButton from "../../components/buttons/BiometricButton";
import { useUserDetails } from "../../constants/Store";
import axios from "axios";
import API from "../../hooks/API";
const { width, height } = Dimensions.get("screen");

const Login = ({ navigation }) => {
	const ToHome = () => {
		navigation.replace("drawer", {
			params: "AppStack",
			params: {
				params: "Home",
			},
		});
	};

	const {
		email,
		setEmail,
		password,
		setPassword,
		setFirstName,
		setAccessToken,
		accessToken,
	} = useUserDetails((state) => ({
		email: state.email,
		setEmail: state.setEmail,
		password: state.password,
		setPassword: state.setPassword,
		setFirstName: state.setFirstName,
		accessToken: state.accessToken,
		setAccessToken: state.setAccessToken,
	}));
	const [loading, setLoading] = useState(false);
	const handleLogin = async () => {
		setLoading(true);
		const request = { email, password };
		const header = {
			headers: { Authorization: `Bearer ${accessToken}` },
		};
		try {
			const response = await axios.post(API.Login, request);
			console.log(response?.data?.access_token);
			if (response?.data?.access_token) {
				setAccessToken(response?.data?.access_token);
				const userResponse = await axios.get(API.UserProfile, header);
				console.log("user response", userResponse?.data);
				setFirstName(userResponse?.data?.name);
			}
		} catch (error) {
			setLoading(false);
			console.log(error?.response);
		} finally {
			setLoading(false);
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
							text={"Email Address"}
							placeholder={"johndoe22@gmail.com"}
							onChangeText={(text) => setEmail(text)}
						/>
						<TextInput1
							text={"Password"}
							placeholder={"*************"}
							password
							onChangeText={(text) => setPassword(text)}
						/>
						<Text style={styles.forgot}>Forgot password?</Text>
						<View style={styles.buttons}>
							<View style={styles.logInButton}>
								<ActiveButton
									title={"Login"}
									loading={loading}
									onPress={() => handleLogin()}
								/>
							</View>
							<BiometricButton navigate={() => ToHome()} />
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
		height: height - 140,
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
		width: "85%",
	},
	buttons: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
});
