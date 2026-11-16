import { StyleSheet, View } from "react-native";
import React from "react";
import { Octicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";

const AcceptHeader = () => {
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};
	// The button sits in the normal layout flow, inside a container that has height. It used to
	// be absolutely positioned inside a zero-height container, and iOS doesn't deliver touches
	// to a view that lies outside its parent's frame, so the button showed but couldn't be tapped.
	return (
		<View style={[styles.container, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
			<TouchableOpacity
				style={styles.drawerNav}
				activeOpacity={0.7}
				onPress={OpenDrawer}
			>
				<View>
					<Octicons name="three-bars" size={24} color="black" />
				</View>
			</TouchableOpacity>
		</View>
	);
};

export default AcceptHeader;

const styles = StyleSheet.create({
	container: {
		paddingLeft: 16,
		alignItems: "flex-start",
	},
	drawerNav: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		elevation: 5,
	},
});
