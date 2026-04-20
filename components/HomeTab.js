import { StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import WhereTo from "./WhereTo";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { sp, fs, br, ms } from "../constants/responsive";
import {
	useBottomTabStore,
	useUserDetails,
	useRideStore,
	useRideDetailsStore,
	useActiveRideStore,
} from "../constants/Store";
import { formatDate } from "date-fns";

const TODAY_FORMATTED = formatDate(new Date(), "dd/MM/yyyy");

const HomeTab = () => {
	const Passengers = useBottomTabStore((state) => state.PassengerPage);
	const { firstName } = useUserDetails((state) => ({
		firstName: state.firstName,
	}));
	const { destination, location } = useRideStore((state) => ({
		destination: state.destination,
		location: state.location,
	}));
	const { pickupLocation, destination: destinationCoords } =
		useRideDetailsStore((state) => ({
			pickupLocation: state.pickupLocation,
			destination: state.destination,
		}));

	// Check if there's an active ride
	const activeRide = useActiveRideStore(state => state.activeRide);
	const hasActiveRide = !!activeRide;

	// Define canContinue based on location and destination selection
	const canContinue = !!location && !!destination;

	return (
		<BottomSheet
			snapPoints={["46%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			<BottomSheetScrollView>
				<View style={styles.sheetCont}>
					<View style={styles.topText}>
						<Text style={styles.greet}>
							Hello, <Text style={{ color: colors.primaryBlue }}>{firstName || 'User'}</Text>
						</Text>
						<Text style={styles.where}>Where are you going?</Text>
					</View>
					<WhereTo disabled={hasActiveRide} />
					<View style={styles.dateCont}>
						<Feather name="calendar" size={ms(24)} color={colors.primaryBlue} />
						<Text style={styles.date}>{TODAY_FORMATTED}</Text>
					</View>

					{/* Show different messages based on state */}
					{hasActiveRide ? (
						<View style={styles.lockedContainer}>
							<Feather name="lock" size={ms(20)} color={colors.primaryBlue} />
							<Text style={styles.lockedText}>
								Complete your current ride to book another
							</Text>
						</View>
					) : (
						<>
							{!canContinue && (
								<Text style={styles.helperText}>
									Please select both pickup and destination to continue
								</Text>
							)}
							<View style={styles.button}>
								<ActiveButton
									title={"Continue"}
									onPress={Passengers}
									disabled={!canContinue}
								/>
							</View>
						</>
					)}
				</View>
			</BottomSheetScrollView>
		</BottomSheet>
	);
};

export default HomeTab;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: sp(16),
		paddingTop: sp(30),
		paddingHorizontal: sp(16),
	},
	topText: {
		marginBottom: sp(10),
	},
	greet: {
		fontSize: fs(16),
		fontWeight: "regular",
		color: "black",
		marginBottom: sp(4),
	},
	where: {
		fontSize: fs(24),
		fontWeight: "bold",
		color: "black",
	},
	dateCont: {
		flexDirection: "row",
		marginVertical: sp(16),
		alignItems: "center",
	},
	date: {
		fontSize: fs(16),
		fontWeight: "regular",
		color: "black",
		marginLeft: sp(8),
	},
	helperText: {
		fontSize: fs(14),
		color: colors.lightGrey3,
		textAlign: "center",
		marginTop: sp(8),
		fontStyle: "italic",
	},
	lockedContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.secondary,
		padding: sp(16),
		borderRadius: br(12),
		marginTop: sp(16),
		borderWidth: 1,
		borderColor: colors.primaryBlue,
	},
	lockedText: {
		fontSize: fs(14),
		color: colors.primaryBlue,
		marginLeft: sp(8),
		fontWeight: "600",
	},
	button: {
		marginTop: sp(20),
	},
});
