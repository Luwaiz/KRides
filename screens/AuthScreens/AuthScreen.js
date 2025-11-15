import { Image, StyleSheet, Text, View } from "react-native";
import React from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors } from "../../constants/styling";
import ActiveButton from "../../components/buttons/ActiveButton";
import LoginButton from "../../components/buttons/LoginButton";
import Terms from "../../components/Terms";
import KRideLogo from "../../assets/svg/WhiteLogo.svg";

const AuthScreen = ({ navigation }) => {
	const Navigate = (page) => {
		navigation.navigate(page);
	};

	return (
		<View style={styles.container}>
			<View style={styles.topContainer}>
				<KRideLogo />
			</View>
			<BottomSheet
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
				snapPoints={["50%"]}
			>
				<View style={styles.sheet}>
					<Text style={styles.welcome}>Welcome!</Text>
					<ActiveButton title={"Sign up"} onPress={() => Navigate("Signup")} />
					<LoginButton title={"Log in"} onPress={() => Navigate("Login")} />
					<LoginButton
						title={"Driver Sign up"}
						onPress={() => Navigate("DriverSignup")}
					/>
					<LoginButton
						title={"Driver Log in"}
						onPress={() => Navigate("DriverLogin")}
					/>
				</View>
				<Terms />
			</BottomSheet>
		</View>
	);
};

export default AuthScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.primaryBlue,
		alignItems: "center",
	},
	topContainer: {
		flex: 0.6,
		backgroundColor: colors.primaryBlue,
		alignItems: "center",
		justifyContent: "center",
	},
	sheet: {
		flex: 1,
		alignItems: "center",
		paddingVertical: 30,
	},
	welcome: {
		fontSize: 20,
		fontWeight: "bold",
		color: colors.primaryBlue,
		marginBottom: 20,
		marginTop: 20,
		textAlign: "center",
	},
});
