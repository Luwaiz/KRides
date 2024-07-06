import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { Octicons } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import ActiveButton from "../../components/buttons/ActiveButton";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import WhereTo from "../../components/WhereTo";
import { useAuthStore } from "../../constants/Store";
const MainPage = () => {
	const navigation = useNavigation();
	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};
	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.drawerNav}
				activeOpacity={0.7}
				onPress={OpenDrawer}
			>
				<View>
					<Octicons name="three-bars" size={24} color="black" />
				</View>
			</TouchableOpacity>
			<BottomSheet
				snapPoints={["46%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				<View style={styles.sheetCont}>
					<View style={styles.topText}>
						<Text style={styles.greet}>
							Hello, <Text style={{ color: colors.primaryBlue }}>Tobi</Text>
						</Text>
						<Text style={styles.where}>Where are you going?</Text>
					</View>
					<WhereTo />
					<View style={styles.dateCont}>
						<Feather name="calendar" size={24} color={colors.primaryBlue} />
						<Text style={styles.date}>14/7/2023</Text>
					</View>
					<View style={styles.button}>
						<ActiveButton title={"Continue"} />
					</View>
				</View>
			</BottomSheet>
		</View>
	);
};

export default MainPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		backgroundColor: colors.lightGrey2,
	},
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	topText: {
		marginBottom: 10,
	},
	greet: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
		marginBottom: 4,
	},
	where: {
		fontSize: 24,
		fontWeight: "bold",
		color: "black",
	},
	dateCont: {
		flexDirection: "row",
		marginVertical: "auto",
		alignItems: "center",
	},
	date: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
	},
	button: {
		marginTop: "auto",
	},
	drawerNav: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		position: "absolute",
		top: 40,
		left: 16,
	},
});
