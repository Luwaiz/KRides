import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useRef, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors } from "../../constants/styling";
import ActiveButton from "../../components/buttons/ActiveButton";
import LoginButton from "../../components/buttons/LoginButton";
import Terms from "../../components/Terms";
import KRideLogo from "../../assets/svg/WhiteLogo.svg";

const AuthScreen = ({ navigation }) => {
	const [activeTab, setActiveTab] = useState("customer");
	const tabAnim = useRef(new Animated.Value(0)).current;

	const selectTab = (tab) => {
		if (tab === activeTab) return;
		setActiveTab(tab);
		Animated.timing(tabAnim, {
			toValue: tab === "customer" ? 0 : 1,
			duration: 260,
			useNativeDriver: false,
		}).start();
	};

	const customerWidth = tabAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["70%", "30%"],
	});
	const driverWidth = tabAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["30%", "70%"],
	});

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
						<Animated.View style={[styles.tabSegment, { width: customerWidth }]}>
							<TouchableOpacity
								style={styles.tabTouchable}
								onPress={() => selectTab("customer")}
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
								{activeTab === "customer" && <View style={styles.tabUnderline} />}
							</TouchableOpacity>
						</Animated.View>
						<Animated.View style={[styles.tabSegment, { width: driverWidth }]}>
							<TouchableOpacity
								style={styles.tabTouchable}
								onPress={() => selectTab("driver")}
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
								{activeTab === "driver" && <View style={styles.tabUnderline} />}
							</TouchableOpacity>
						</Animated.View>
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
		alignSelf: "stretch",
		marginHorizontal: 28,
		marginBottom: 24,
	},
	tabSegment: {
		height: 42,
	},
	tabTouchable: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	tabText: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.lightGrey4,
	},
	tabTextActive: {
		color: colors.primaryBlue,
	},
	tabUnderline: {
		marginTop: 8,
		height: 3,
		width: 32,
		borderRadius: 2,
		backgroundColor: colors.primaryBlue,
	},
	termsCont: {
		paddingBottom: 28,
	},
});
