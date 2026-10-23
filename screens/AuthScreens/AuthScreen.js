import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors } from "../../constants/styling";
import ActiveButton from "../../components/buttons/ActiveButton";
import LoginButton from "../../components/buttons/LoginButton";
import Terms from "../../components/Terms";
import KRideLogo from "../../assets/svg/WhiteLogo.svg";

const AuthScreen = ({ navigation }) => {
	const [activeTab, setActiveTab] = useState("customer");

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

					<View style={styles.tabRow}>
						<TouchableOpacity
							style={[styles.tab, activeTab === "customer" && styles.tabActive]}
							onPress={() => setActiveTab("customer")}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tabText,
									activeTab === "customer" && styles.tabTextActive,
								]}
							>
								Customer
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.tab, activeTab === "driver" && styles.tabActive]}
							onPress={() => setActiveTab("driver")}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tabText,
									activeTab === "driver" && styles.tabTextActive,
								]}
							>
								Driver
							</Text>
						</TouchableOpacity>
					</View>

					{activeTab === "customer" ? (
						<>
							<ActiveButton title={"Sign up"} onPress={() => Navigate("Signup")} />
							<LoginButton title={"Log in"} onPress={() => Navigate("Login")} />
						</>
					) : (
						<>
							<ActiveButton
								title={"Sign up"}
								onPress={() => Navigate("DriverSignup")}
							/>
							<LoginButton
								title={"Log in"}
								onPress={() => Navigate("DriverLogin")}
							/>
						</>
					)}
				</View>
				<View style={styles.termsCont}>
					<Terms />
				</View>
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
	tabRow: {
		flexDirection: "row",
		backgroundColor: colors.lightGrey2,
		borderRadius: 12,
		padding: 4,
		width: 240,
		marginBottom: 20,
	},
	tab: {
		flex: 1,
		height: 38,
		borderRadius: 9,
		alignItems: "center",
		justifyContent: "center",
	},
	tabActive: {
		backgroundColor: colors.primaryBlue,
	},
	tabText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.lightGrey4,
	},
	tabTextActive: {
		color: colors.secondary,
	},
	termsCont: {
		paddingBottom: 28,
	},
});
