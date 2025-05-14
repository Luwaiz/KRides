import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import React, { use, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import GoogleButton from "../../components/buttons/GoogleButton";
import Terms from "../../components/Terms";
import BackButton from "../../components/buttons/BackButton";
import { useUserDetails } from "../../constants/Store";
import axios from "axios";
import API from "../../hooks/API";
const { width, height } = Dimensions.get("screen");

const Signup = ({ navigation }) => {
	const [email,setMail] = useState("")
	const [password, setPass] = useState("")
	const [phone, setPhoneNumber] = useState("")
	const [firstName, setFirst] = useState("")
	const [lastName, setLast] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const {
		setEmail,
		setPhone,
		setFirstName,
		setLastName,
		setUserId,
	} = useUserDetails((state) => ({
		setEmail: state.setEmail,
		setPhone: state.setPhone,
		setFirstName: state.setFirstName,
		setLastName: state.setLastName,
		setUserId: state.setUserId,
	}));

	const passwordCheck = (password) => {
		if (password?.length < 8) {
			alert(
				"Password must contain at least 8 characters, including uppercase and lowercase letters, numbers, and special characters."
			);
			return false;
		}
		return true;
	};

	const VerifyPassword = (password, confirmPassword) => {
		if (password !== confirmPassword) {
			alert("Passwords do not match.");
			return false;
		}
		return true;
	};

	const handleSignUp = async (password, confirmPassword) => {
		setLoading(true);
		if (!passwordCheck(password)) {
			setLoading(false);
			return;
		}
		if (!VerifyPassword(password, confirmPassword)) {
			setLoading(false);
			return;
		}

		const request = {
			email,
			password,
			phone,
			firstName,
			lastName,
		};
		try {
			const response = await axios.post(API.Register, request);
			console.log(response?.data);
			setUserId(response?.data?.user?.id);
			setFirstName(response?.data?.user?.firstName)
			setLastName(response?.data?.user?.lastName)
			setEmail(response?.data?.user?.email)
			setPhone(response?.data?.user?.phone)
			navigation.navigate("VerifyNo");
			setLoading(false);
		} catch (error) {
			setLoading(false);
			try {
				console.log(error?.response?.data.message)
				// Check if error response exists
				const errorData = error?.response?.data;
				const parsedData =
					typeof errorData === "string" ? JSON.parse(errorData) : errorData;
				const emailErrors = parsedData?.email || [];
				if (emailErrors.length > 0) {
					alert(emailErrors[0]); // Show error message to the user
				} else {
					console.log("No email errors found.");
				}
			} catch (parseError) {
				console.error("Error parsing response data:", parseError);
				alert("An unknown error occurred.");
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
								text={"First Name"}
								placeholder={"John"}
								onChangeText={(text) => setFirst(text)}
							/>
							<TextInput1
								text={"Last Name"}
								placeholder={"Doe"}
								onChangeText={(text) => setLast(text)}
							/>
							<TextInput1
								text={"School Email Address"}
								placeholder={"john2022@student.babcock.edu.ng"}
								onChangeText={(text) => setMail(text)}
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
									email === "" ||
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
		width: width,
		marginTop: 20,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
	},
});
