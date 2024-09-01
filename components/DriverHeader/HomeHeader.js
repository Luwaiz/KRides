import { StatusBar, StyleSheet, Text, View } from "react-native";
import React from "react";
import { Octicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { colors } from "../../constants/styling";

const HomeHeader = () => {
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
			<View style={styles.box}></View>
			<View style={styles.box}></View>
		</View>
	);
};

export default HomeHeader;

const styles = StyleSheet.create({
	container: {
		width: "100%",
		height: 100,
		backgroundColor: colors.primary,
		paddingTop: StatusBar.currentHeight + 10,
		flexDirection: "row",
		justifyContent: "center",
	},

	drawerNav: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		marginRight: 10,
	},
	box: {
		width: 140,
		height: 80,
		backgroundColor: colors.secondary,
		marginHorizontal: 5,
		borderRadius: 10,
		justifyContent: "center",
		alignItems: "center",
	},
});
