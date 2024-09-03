import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { Octicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { colors } from "../../constants/styling";

const AcceptHeader = () => {
	const navigation = useNavigation();
	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};
	return (
		<TouchableOpacity
			style={styles.drawerNav}
			activeOpacity={0.7}
			onPress={OpenDrawer}
		>
			<View>
				<Octicons name="three-bars" size={24} color="black" />
			</View>
		</TouchableOpacity>
	);
};

export default AcceptHeader;

const styles = StyleSheet.create({
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
