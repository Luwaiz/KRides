import {
	Image,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useState } from "react";
import { AntDesign } from "@expo/vector-icons";
import { Fontisto } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import DestinationPick from "../../components/destinationPick";
import ActiveButton from "../../components/buttons/ActiveButton";
import { useRideStore } from "../../constants/Store";

const PickDestination = ({ navigation }) => {
	const GoBack = () => {
		navigation.goBack();
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<View style={styles.headCont}>
					<TouchableOpacity onPress={() => GoBack()}>
						<Fontisto name="close-a" size={18} color="black" />
					</TouchableOpacity>
					<Text style={styles.headText}>Where are you going?</Text>
				</View>
				<DestinationPick />

				<ActiveButton title={"Done"} onPress={() => GoBack()} />
			</View>
		</SafeAreaView>
	);
};

export default PickDestination;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	topCont: {
		backgroundColor: colors.secondary,
		padding: 16,
		marginBottom: 10,
	},
	headCont: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 14,
		alignItems: "center",
	},
	headText: {
		fontSize: 20,
		fontWeight: "600",
		color: "black",
	},
});
