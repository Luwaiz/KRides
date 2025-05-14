import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import React, { useState } from "react";
import { AntDesign } from "@expo/vector-icons";
import { colors } from "../constants/styling";
import BlueDot from "../assets/svg/Frame 33blueDot.svg";
import Marker from "../assets/svg/Framemarker.svg";
import { useRideStore } from "../constants/Store";

const DestinationPick = () => {
	const [location, set_Location] = useState("");
	const [destination, set_Destination] = useState("");
	const { setDestination, setLocation } = useRideStore((state) => ({
		setDestination: state.setDestination,
		setLocation: state.setLocation,
	}));

	const DestinationText = (value) => {
		setDestination(value);
		set_Destination(value);
	};

	const LocationText = (value) => {
		setLocation(value.trim(""));
		set_Location(value);
	};

	return (
		<View style={styles.lowerCont}>
			<View style={styles.InputCont}>
				<BlueDot />
				<TextInput
					style={styles.input}
					placeholder="Choose Pickup Location"
					placeholderTextColor={colors.lightGrey3}
					onChangeText={(text) => LocationText(text)}
					value={location}
				/>
			</View>
			<View
				style={[
					styles.InputCont,
					{ alignItems: "center", paddingHorizontal: 20 },
				]}
			>
				<Marker />
				<TextInput
					style={[styles.input, { marginLeft: 20 }]}
					placeholder="Choose Destination"
					placeholderTextColor={colors.lightGrey3}
					onChangeText={(text) => DestinationText(text)}
					value={destination}
				/>
				<AntDesign
					style={styles.cancel}
					name="close"
					size={24}
					color={colors.lightGrey4}
					onPress={() => {
						setDestination("");
						set_Destination("");
					}}
				/>
			</View>
		</View>
	);
};

export default DestinationPick;

const styles = StyleSheet.create({
	lowerCont: {
		width: "100%",
		gap: 16,
		marginBottom: 20,
	},
	InputCont: {
		height: 59,
		backgroundColor: colors.lightGrey2,
		flexDirection: "row",
		borderRadius: 8,
	},
	input: {
		flex: 1,
		height: "100%",
		fontSize: 16,
	},
	redDot: {
		marginHorizontal: 20,
	},
	cancel: {},
});
