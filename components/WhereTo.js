import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../constants/styling";
import { sp, fs, br, hp, wp } from "../constants/responsive";
import { useNavigation } from "@react-navigation/native";
import Direction from "../assets/svg/Frame 34direction.svg";
import { useRideStore, useRideDetailsStore } from "../constants/Store";
import LocationPicker from "./LocationPicker";

const WhereTo = () => {
	const [showPickupPicker, setShowPickupPicker] = useState(false);
	const [showDestinationPicker, setShowDestinationPicker] = useState(false);

	const { destination, location, setDestination, setLocation } = useRideStore(
		(state) => ({
			destination: state.destination,
			location: state.location,
			setDestination: state.setDestination,
			setLocation: state.setLocation,
		})
	);

	const { setPickupLocation, setDestination: setDestinationCoords } =
		useRideDetailsStore();

	const navigation = useNavigation();

	const handlePickupSelect = (selectedLocation) => {
		setLocation(selectedLocation.name);
		setPickupLocation({
			latitude: selectedLocation.latitude,
			longitude: selectedLocation.longitude,
			name: selectedLocation.name,
			address: selectedLocation.address,
		});
		console.log("Pickup selected:", selectedLocation);
	};

	const handleDestinationSelect = (selectedLocation) => {
		setDestination(selectedLocation.name);
		setDestinationCoords({
			latitude: selectedLocation.latitude,
			longitude: selectedLocation.longitude,
			name: selectedLocation.name,
			address: selectedLocation.address,
		});
		console.log("Destination selected:", selectedLocation);
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
								{location !== "" ? location : "Choose Pickup Location"}
							</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						activeOpacity={0.7}
						onPress={() => setShowDestinationPicker(true)}
					>
						<View style={styles.destination}>
							<Text style={styles.destinationText}>
								{destination !== "" ? destination : "Choose Destination"}
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
				showPopularOnly={false}
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

export default WhereTo;

const styles = StyleSheet.create({
	locations: {
		alignSelf: "center",
		backgroundColor: colors.lightGrey2,
		width: "100%",
		height: hp(140),
		borderRadius: br(16),
		flexDirection: "row",
	},
	destinations: {
		minWidth: wp(270),
		flex: 1,
		height: "100%",
		justifyContent: "space-between",
		paddingVertical: sp(10),
	},
	destination: {
		width: "95%",
		minHeight: sp(50),
		backgroundColor: colors.secondary,
		borderRadius: br(8),
		padding: sp(8),
		justifyContent: "center",
	},
	destinationText: {
		fontSize: fs(16),
		fontWeight: "regular",
		color: "black",
	},
	pointer: {
		marginTop: sp(5),
	},
});
