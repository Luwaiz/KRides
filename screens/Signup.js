import { Dimensions, StyleSheet, Text, View } from "react-native";
import React from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors } from "../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import { AntDesign } from "@expo/vector-icons";
import TextInput1 from "../components/TextInput1";
import ActiveButton from "../components/buttons/ActiveButton";
import GoogleButton from "../components/buttons/GoogleButton";
import Terms from "../components/Terms";
const { width, height } = Dimensions.get("screen");

const Signup = () => {
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<View style={styles.headCont}>
					<View style={styles.back}>
						<AntDesign name="arrowleft" size={24} color="black" />
					</View>
					<Text style={styles.headText}>Sign Up</Text>
				</View>
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
						/>
						<TextInput1 text={"Phone Number"} placeholder={"08123456789"} />
						<TextInput1
							text={"Password"}
							placeholder={"*************"}
							password
						/>
						<TextInput1
							text={"Confirm Password"}
							placeholder={"*************"}
							password
						/>
						<ActiveButton title={"Sign up"} />
						<View style={styles.OrContainer}>
							<View style={styles.dash} />
							<Text style={styles.OrText}>OR</Text>
							<View style={styles.dash} />
						</View>
						<GoogleButton title={"Continue with Google"} />
						<Terms />
					</View>
				</View>
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
	headCont: {
		width,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	back: {
		width: 48,
		height: 48,
		borderRadius: 50,
		backgroundColor: colors.lightGrey2,
		alignItems: "center",
		justifyContent: "center",
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
