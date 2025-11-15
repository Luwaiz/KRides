import { StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import Phone from "../../assets/svg/Call.svg";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { sp, fs, br, ms } from "../../constants/responsive";
import { useBottomTabStore, useAcceptedRideStore } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import Arrival from "../modals/Arrival";
import { updateRideStatus } from "../../helpers/firebaseRides";

const AcceptTab = () => {
	const [endRide, setEndRide] = useState(false);
	const [loading, setLoading] = useState(false);
	const acceptedRide = useAcceptedRideStore((state) => state.acceptedRide);
	const clearAcceptedRide = useAcceptedRideStore(
		(state) => state.clearAcceptedRide
	);

	const RideEnded = async () => {
		if (!acceptedRide?.rideId) {
			console.log("⚠️ No ride ID found to complete");
			return;
		}

		setLoading(true);
		try {
			console.log("✅ Completing ride:", acceptedRide.rideId);
			// Update ride status to completed in Firebase
			await updateRideStatus(acceptedRide.rideId, "completed");
			console.log("✅ Ride marked as completed");

			// Show success modal and clear ride data
			setEndRide(true);
			clearAcceptedRide();
		} catch (error) {
			console.error("❌ Error completing ride:", error);
			alert(
				"Unable to complete ride. Please check your connection and try again."
			);
		} finally {
			setLoading(false);
		}
	};
	return (
		<>
			<BottomSheet
				snapPoints={["40%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				<BottomSheetScrollView>
					<View style={styles.sheetCont}>
						<View style={styles.topText}>
							<Text style={styles.where}>Ride request</Text>
							<Text style={styles.time}>
								{acceptedRide?.pickupCoords?.name || "Picking up..."}
							</Text>
						</View>
						<View style={styles.details}>
							<View style={styles.detailCont}>
								<Avatar width={50} height={50} />
								<View>
									<Text style={styles.name}>
										{acceptedRide?.name || "Henry"}
									</Text>
									<Text style={styles.time}>Cash payment</Text>
									<Text style={styles.time}>
										N{acceptedRide?.amount || "150"}
									</Text>
								</View>
							</View>
							<Phone width={24} height={24} />
						</View>

						{/* Show route info */}
						{acceptedRide && (
							<View style={styles.routeInfo}>
								<Text style={styles.routeLabel}>From:</Text>
								<Text style={styles.routeText}>
									{acceptedRide.location || acceptedRide.pickupCoords?.name}
								</Text>
								<Text style={styles.routeLabel}>To:</Text>
								<Text style={styles.routeText}>
									{acceptedRide.destination ||
										acceptedRide.destinationCoords?.name}
								</Text>
							</View>
						)}

						<View style={styles.button}>
							<ActiveButton
								title={"Complete Ride"}
								onPress={RideEnded}
								loading={loading}
							/>
						</View>
					</View>
				</BottomSheetScrollView>
			</BottomSheet>
			<Arrival modal={endRide} setModal={setEndRide} />
		</>
	);
};

export default AcceptTab;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: sp(16),
		paddingTop: sp(30),
		paddingHorizontal: sp(16),
	},
	topText: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: sp(16),
	},
	time: {
		color: colors.lightGrey3,
		fontSize: fs(14),
	},
	details: {
		alignItems: "center",
		marginBottom: sp(16),
		flexDirection: "row",
		gap: sp(10),
		justifyContent: "space-between",
	},
	detailCont: {
		flexDirection: "row",
		alignItems: "center",
		gap: sp(10),
	},
	where: {
		fontSize: fs(24),
		fontWeight: "bold",
		color: "black",
		flexShrink: 1,
	},
	name: {
		fontFamily: "Albert-SemiBold",
		fontSize: fs(16),
	},
	button: {
		marginTop: sp(20),
	},
	routeInfo: {
		backgroundColor: colors.secondary,
		padding: sp(12),
		borderRadius: br(8),
		marginBottom: sp(12),
	},
	routeLabel: {
		fontSize: fs(12),
		color: colors.lightGrey3,
		marginTop: sp(4),
	},
	routeText: {
		fontSize: fs(14),
		fontWeight: "500",
		color: "black",
		marginBottom: sp(4),
	},
});
