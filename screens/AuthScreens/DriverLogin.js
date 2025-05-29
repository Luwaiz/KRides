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
import { useDriverDetails, useUserDetails } from "../../constants/Store";
import axios from "axios";
import API from "../../hooks/API";
const { width, height } = Dimensions.get("screen");

const DriverLogin = ({ navigation }) => {
	const [phone, set_phone] = useState();
	const [password, set_password] = useState();

	const ToHome = () => {
		navigation.replace("DriverStack", {
			params: {
				params: "DriverHome",
			},
		});
	};

	const { setAccessToken, setPhone, setFullName, setVehicleId } =
		useDriverDetails((state) => ({
			setAccessToken: state.setAccessToken,
			setPhone: state.setPhone,
			setFullName: state.setFullName,
			setVehicleId: state.setVehicleId,
		}));
	const [loading, setLoading] = useState(false);

	const loginUser = async (request) => {
		try {
			const response = await axios.post(API.DriverLogin, request);
			console.log("loggeed in Access Token:", response?.data);

			if (response?.data?.access_token) {
				setAccessToken(response.data.access_token);
				fetchUserProfile(response.data.access_token); // Call the next function
			} else {
				console.error("Access token not found.");
			}
		} catch (error) {
			setLoading(false);
			console.log("Login Error:", error?.response?.data || error?.message);
			alert("Login failed. Please check your credentials and try again.");
		}
	};

	const fetchUserProfile = async (accessToken) => {
		try {
			const userResponse = await axios.get(API.DriverProfile, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});

			console.log("User Response:", userResponse?.data?.data);
			setPhone(userResponse?.data?.data?.phone);
			setFullName(userResponse?.data?.data?.fullName);
			setVehicleId(userResponse?.data?.data?.vehicle_id);
			setLoading(false);
			ToHome();
		} catch (error) {
			setLoading(false);
			console.error(
				"User Profile Error:",
				error.response?.data || error.message
			);
			alert("Failed to fetch user profile. Please try again.");
		}
	};

	const handleLogin = () => {
		setLoading(true);
		const request = {
			phone,
			password,
		};
		loginUser(request);
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
							placeholder={"09182828281"}
							onChangeText={(text) => set_phone(text)}
						/>
						<TextInput1
							text={"Password"}
							placeholder={"*************"}
							password
							onChangeText={(text) => set_password(text)}
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
