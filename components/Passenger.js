import { StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import WhereTo from "./WhereTo";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { sp, fs, br } from "../constants/responsive";
import { RadioButton } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import {
	useBottomTabStore,
	useRideStore,
	useRideDetailsStore,
} from "../constants/Store";
import {
	calculateDistance,
	calculateEstimatedTime,
	formatDistance,
	formatTime,
	calculateFare,
} from "../helpers/rideCalculations";

const Passenger = () => {
	const MIN_PASSENGERS = 1;
	const MAX_PASSENGERS = 3; // Keke capacity
	const [selected, setSelected] = useState(null);
	const [error, setError] = useState("");
	const [distance, setDistance] = useState(0);
	const [estimatedTime, setEstimatedTime] = useState(0);

	const confirm = useBottomTabStore((state) => state.setConfirmPage);
	const { setNumberOfPassenger } = useRideStore((state) => ({
		setNumberOfPassenger: state.setNumberOfPassenger,
	}));

	const { pickupLocation, destination: destinationCoords } =
		useRideDetailsStore((state) => ({
			pickupLocation: state.pickupLocation,
			destination: state.destination,
		}));

	// Calculate distance and time when locations change
	useEffect(() => {
		if (pickupLocation && destinationCoords) {
			const dist = calculateDistance(
				{
					latitude: pickupLocation.latitude,
					longitude: pickupLocation.longitude,
				},
				{
					latitude: destinationCoords.latitude,
					longitude: destinationCoords.longitude,
				}
			);
			setDistance(dist);
			setEstimatedTime(calculateEstimatedTime(dist));
			console.log("📏 Distance:", dist, "km");
			console.log("⏱️ Estimated time:", calculateEstimatedTime(dist), "min");
		}
	}, [pickupLocation, destinationCoords]);

	const handlePassengerSelect = (value) => {
		const numValue = parseInt(value);

		// Validate passenger count
		if (numValue < MIN_PASSENGERS) {
			setError(`Minimum ${MIN_PASSENGERS} passenger required`);
			setSelected(null);
			return;
		}

		if (numValue > MAX_PASSENGERS) {
			setError(`Maximum ${MAX_PASSENGERS} passengers allowed`);
			setSelected(null);
			return;
		}

		// Valid selection
		setError("");
		setSelected(value);
	};

	const collectRides = () => {
		if (!selected) {
			setError("Please select number of passengers");
			return;
		}

		setNumberOfPassenger(selected);
		confirm(); // Go directly to ConfirmRide, skip AvailableRiders
	};

	// Calculate estimated price based on distance and passengers
	const estimatedPrice = selected
		? calculateFare(distance, parseInt(selected))
		: 0;

	return (
		<BottomSheet
			snapPoints={["40%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			<BottomSheetScrollView>
				<View style={styles.sheetCont}>
					<Text style={styles.where}>Select number of passengers</Text>
					<Text style={styles.subtitle}>
						Maximum {MAX_PASSENGERS} passengers per ride
					</Text>

					<View style={styles.RadioContainer}>
						<RadioButton.Android
							value="1"
							status={selected === "1" ? "checked" : "unchecked"}
							onPress={() => handlePassengerSelect("1")}
							color={colors.primaryBlue}
						/>
						<Text style={styles.radioText}>1 Passenger</Text>
					</View>
					<View style={styles.RadioContainer}>
						<RadioButton.Android
							value="2"
							status={selected === "2" ? "checked" : "unchecked"}
							onPress={() => handlePassengerSelect("2")}
							color={colors.primaryBlue}
						/>
						<Text style={styles.radioText}>2 Passengers</Text>
					</View>
					<View style={styles.RadioContainer}>
						<RadioButton.Android
							value="3"
							status={selected === "3" ? "checked" : "unchecked"}
							onPress={() => handlePassengerSelect("3")}
							color={colors.primaryBlue}
						/>
						<Text style={styles.radioText}>3 Passengers</Text>
					</View>

					{/* Error Message */}
					{error ? (
						<View style={styles.errorContainer}>
							<Feather name="alert-circle" size={16} color={colors.error} />
							<Text style={styles.errorText}>{error}</Text>
						</View>
					) : null}

					{/* Distance and Time Info */}
					{distance > 0 && (
						<View style={styles.infoCard}>
							<View style={styles.infoRow}>
								<Feather
									name="navigation"
									size={18}
									color={colors.primaryBlue}
								/>
								<Text style={styles.infoLabel}>Distance:</Text>
								<Text style={styles.infoValue}>{formatDistance(distance)}</Text>
							</View>
							<View style={styles.infoRow}>
								<Feather name="clock" size={18} color={colors.primaryBlue} />
								<Text style={styles.infoLabel}>Est. Time:</Text>
								<Text style={styles.infoValue}>
									{formatTime(estimatedTime)}
								</Text>
							</View>
						</View>
					)}

					{/* Price Preview */}
					{selected && (
						<View style={styles.pricePreview}>
							<Text style={styles.priceLabel}>Estimated Fare:</Text>
							<Text style={styles.priceAmount}>₦ {estimatedPrice}</Text>
						</View>
					)}

					<View style={styles.button}>
						<ActiveButton
							disabled={selected === null}
							title={
								selected === null
									? "Select passengers first"
									: "Continue to Booking"
							}
							onPress={() => collectRides()}
						/>
					</View>
				</View>
			</BottomSheetScrollView>
		</BottomSheet>
	);
};

export default Passenger;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: sp(16),
		paddingTop: sp(30),
		paddingHorizontal: sp(16),
	},
	RadioContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: sp(20),
	},
	where: {
		fontSize: fs(24),
		fontWeight: "bold",
		color: "black",
		marginBottom: sp(8),
	},
	subtitle: {
		fontSize: fs(14),
		color: colors.lightGrey3,
		marginBottom: sp(16),
	},
	radioText: {
		fontSize: fs(16),
		color: "black",
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#ffebee",
		padding: sp(12),
		borderRadius: br(8),
		marginBottom: sp(12),
		gap: sp(8),
	},
	errorText: {
		fontSize: fs(14),
		color: "#c62828",
		flex: 1,
	},
	infoCard: {
		backgroundColor: colors.secondary,
		padding: sp(16),
		borderRadius: br(12),
		marginBottom: sp(12),
		borderWidth: 1,
		borderColor: colors.lightGrey2,
	},
	infoRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: sp(8),
		gap: sp(8),
	},
	infoLabel: {
		fontSize: fs(14),
		fontFamily: "Albert-Regular",
		color: colors.textGrey,
		flex: 1,
	},
	infoValue: {
		fontSize: fs(16),
		fontFamily: "Albert-SemiBold",
		color: "black",
	},
	pricePreview: {
		backgroundColor: colors.lightGrey,
		padding: sp(16),
		borderRadius: br(12),
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: sp(10),
		marginBottom: sp(10),
	},
	priceLabel: {
		fontSize: fs(16),
		fontWeight: "600",
		color: colors.textGrey,
	},
	priceAmount: {
		fontSize: fs(20),
		fontWeight: "bold",
		color: colors.primaryBlue,
	},
	button: {
		marginTop: sp(20),
	},
});
