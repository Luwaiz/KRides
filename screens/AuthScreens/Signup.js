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
import { createUserWithEmailAndPassword } from "firebase/auth";
const { width, height } = Dimensions.get("screen");

const Signup = ({ navigation }) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const register = async (email, password) => {
		console.log("hello");
		console.log("garri", email, password);
		createUserWithEmailAndPassword(email, password)
			.then((userCredentials) => {
				console.log("User logged in successfully", userCredentials);
			})
			.catch((error) => {
				console.error(error);
			});
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton text={<Text style={styles.headText}>Sign Up</Text>} />
			</View>
			<BottomSheet
				snapPoints={["85%"]}
				handleComponent={null}
				backgroundStyle={{ borderRadius: 30 }}
			>
				<View style={styles.sheetCont}>
					<View style={styles.textInputCont}>
						<TextInput1
							text={"Email Address"}
							placeholder={"johndoe22@gmail.com"}
							onChangeText={setEmail}
						/>
						<TextInput1 text={"Phone Number"} placeholder={"08123456789"} />
						<TextInput1
							text={"Password"}
							placeholder={"*************"}
							password
							onChangeText={setPassword}
						/>
						<TextInput1
							text={"Confirm Password"}
							placeholder={"*************"}
							password
						/>
						<ActiveButton
							title={"Sign up"}
							onPress={() => register(email, password)}
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
			</BottomSheet>
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
		fontWeight: "700",
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
});
