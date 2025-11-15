import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import Direction from "../assets/svg/Frame 34direction.svg";
import LocationPicker from "./LocationPicker";

const Destination = ({
	location,
	destination,
	onPickupSelect,
	onDestinationSelect,
}) => {
	const navigation = useNavigation();
	const [showPickupPicker, setShowPickupPicker] = useState(false);
	const [showDestinationPicker, setShowDestinationPicker] = useState(false);

	const handlePickupSelect = (selectedLocation) => {
		if (onPickupSelect) {
			onPickupSelect(selectedLocation);
		}
	};

	const handleDestinationSelect = (selectedLocation) => {
		if (onDestinationSelect) {
			onDestinationSelect(selectedLocation);
		}
	};

	return (
		<>
			<View style={styles.locations}>
				<View style={styles.pointer}>
					<Direction height={110} />
				</View>
				<View style={styles.destinations}>
					<TouchableOpacity
						activeOpacity={0.7}
						onPress={() => setShowPickupPicker(true)}
					>
						<View style={styles.destination}>
							<Text style={styles.destinationText}>
								{location || "Select pickup location"}
							</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						activeOpacity={0.7}
						onPress={() => setShowDestinationPicker(true)}
					>
						<View style={styles.destination}>
							<Text style={styles.destinationText}>
								{destination || "Select destination"}
							</Text>
						</View>
					</TouchableOpacity>
				</View>
			</View>

			{/* Pickup Location Picker */}
			<LocationPicker
				visible={showPickupPicker}
				onClose={() => setShowPickupPicker(false)}
				onSelectLocation={handlePickupSelect}
				title="Select Pickup Location"
				showPopularOnly={true}
			/>

			{/* Destination Picker */}
			<LocationPicker
				visible={showDestinationPicker}
				onClose={() => setShowDestinationPicker(false)}
				onSelectLocation={handleDestinationSelect}
				title="Select Destination"
				showPopularOnly={false}
			/>
		</>
	);
};

export default Destination;

const styles = StyleSheet.create({
	locations: {
		alignSelf: "center",
		backgroundColor: colors.lightGrey2,
		width: "100%",
		height: 140,
		borderRadius: 16,
		flexDirection: "row",
	},
	destinations: {
		minWidth: 270,
		height: "100%",
		justifyContent: "space-between",
		paddingVertical: 10,
	},
	destination: {
		width: "100%",
		minHeight: 50,
		backgroundColor: colors.secondary,
		borderRadius: 8,
		padding: 8,
		justifyContent: "center",
	},
	destinationText: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
	},
	pointer: {
		marginTop: 5,
	},
});
