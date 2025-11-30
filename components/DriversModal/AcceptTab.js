import { StyleSheet, Text, View, TouchableOpacity, Image } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { MaterialIcons, Octicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import Phone from "../../assets/svg/Call.svg";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { sp, fs, br } from "../../constants/responsive";
import { useAcceptedRideStore, useDriverDetails } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import Arrival from "../modals/Arrival";
import { updateRideStatus, listenToPendingRides } from "../../helpers/firebaseRides";
import { getRideCoordinates } from "../../helpers/getLocationCoordinates";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { calculateDriverEarnings } from "../../constants/commission";

const AcceptTab = () => {
	const [endRide, setEndRide] = useState(false);
	const [loading, setLoading] = useState(false);
	const [accepting, setAccepting] = useState(null);
	const [showPendingRides, setShowPendingRides] = useState(false);
	const [pendingRides, setPendingRides] = useState([]);

	const acceptedRide = useAcceptedRideStore((state) => state.acceptedRide);
	const nextRide = useAcceptedRideStore((state) => state.nextRide);
	const clearAcceptedRide = useAcceptedRideStore((state) => state.clearAcceptedRide);
	const setNextRide = useAcceptedRideStore((state) => state.setNextRide);
	const activateNextRide = useAcceptedRideStore((state) => state.activateNextRide);

	const fullName = useDriverDetails((state) => state.fullName);
	const phone = useDriverDetails((state) => state.phone);
	const VehicleId = useDriverDetails((state) => state.vehicle_id);
	const uid = useDriverDetails((state) => state.uid);

	const navigation = useNavigation();
	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};

	// Listen to pending rides
	useEffect(() => {
		const unsubscribe = listenToPendingRides((rides) => {
			setPendingRides(rides);
		});
		return unsubscribe;
	}, []);

	const RideEnded = async () => {
		if (!acceptedRide?.rideId) {
			console.log("⚠️ No ride ID found to complete");
			return;
		}

		setLoading(true);
		try {
			console.log("✅ Completing ride:", acceptedRide.rideId);
			console.log("📋 Next ride queued?:", !!nextRide);
			if (nextRide) {
				console.log("📋 Next ride details:", {
					rideId: nextRide.rideId,
					customer: nextRide.customerName,
					amount: nextRide.amount
				});
			}

			await updateRideStatus(acceptedRide.rideId, "completed");
			console.log("✅ Ride marked as completed in Firestore");

			// Show success modal
			setEndRide(true);

			// Activate next ride after a brief delay
			setTimeout(() => {
				console.log("⏰ Timeout triggered - checking for next ride...");
				if (nextRide) {
					console.log("🔄 Activating next queued ride:", nextRide.rideId);
					console.log("🔄 Before activation - acceptedRide:", acceptedRide?.rideId);
					activateNextRide();
					console.log("🔄 After activation called");
					setEndRide(false); // Close modal
				} else {
					console.log("🏁 No next ride queued, clearing accepted ride");
					clearAcceptedRide();
				}
			}, 1500);
		} catch (error) {
			console.error("❌ Error completing ride:", error);
			alert("Unable to complete ride. Please check your connection and try again.");
		} finally {
			setLoading(false);
		}
	};

	const AcceptNextRide = async (rideId) => {
		if (nextRide) {
			alert("You already have a ride queued. Complete the current rides first.");
			return;
		}

		console.log("🚗 Accepting next ride:", rideId);
		setAccepting(rideId);

		try {
			const rideDetails = pendingRides.find((r) => (r.rideId || r.id) === rideId);
			if (!rideDetails) {
				throw new Error("Ride not found");
			}

			const { pickup, destination } = await getRideCoordinates(
				rideDetails.pickupLocation,
				rideDetails.destination
			);

			const rideRef = doc(FIREBASE_DB, "rides", rideId);
			await updateDoc(rideRef, {
				status: "accepted",
				driverId: uid || VehicleId,
				driverName: fullName || "Driver",
				driverPhone: phone || "",
				vehicleId: VehicleId || "",
				acceptedAt: serverTimestamp(),
			});

			setNextRide({
				...rideDetails,
				rideId: rideId,
				pickupCoords: pickup,
				destinationCoords: destination,
				driverId: uid || VehicleId,
				driverName: fullName || "Driver",
			});

			console.log("✅ Next ride queued successfully");
			alert("Next ride accepted! It will start after you complete the current ride.");
		} catch (error) {
			console.error("❌ Error accepting next ride:", error);
			alert("Unable to accept ride. Please try again.");
		} finally {
			setAccepting(null);
		}
	};

	return (
		<>
			<BottomSheet
				snapPoints={showPendingRides ? ["70%"] : ["40%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				<BottomSheetScrollView>
					<View style={styles.sheetCont}>
						{/* Menu Button */}

						<View style={styles.topText}>
							<Text style={styles.where}>Current Ride</Text>
							<Text style={styles.time}>
								{acceptedRide?.pickupCoords?.name || "Picking up..."}
							</Text>
						</View>
						<View style={styles.details}>
							<View style={styles.detailCont}>
								{acceptedRide?.customerPhotoURL ? (
									<Image
										source={{ uri: acceptedRide.customerPhotoURL }}
										style={{ width: 50, height: 50, borderRadius: 25 }}
									/>
								) : (
									<Avatar width={50} height={50} />
								)}
								<View>
									<Text style={styles.name}>
										{acceptedRide?.customerName || acceptedRide?.name || "Customer"}
									</Text>
									<Text style={styles.time}>Card Payment</Text>
									<Text style={styles.time}>₦{calculateDriverEarnings(acceptedRide?.amount, acceptedRide?.numberOfPassengers) || "0"}</Text>
								</View>
							</View>
							<Phone width={24} height={24} />
						</View>

						{acceptedRide && (
							<View style={styles.routeInfo}>
								<Text style={styles.routeLabel}>From:</Text>
								<Text style={styles.routeText}>
									{typeof acceptedRide.location === "object"
										? acceptedRide.location?.name || acceptedRide.location?.address
										: acceptedRide.location || acceptedRide.pickupCoords?.name || "Unknown"}
								</Text>
								<Text style={styles.routeLabel}>To:</Text>
								<Text style={styles.routeText}>
									{typeof acceptedRide.destination === "object"
										? acceptedRide.destination?.name || acceptedRide.destination?.address
										: acceptedRide.destination || acceptedRide.destinationCoords?.name || "Unknown"}
								</Text>
							</View>
						)}

						{nextRide && (
							<View style={styles.nextRideInfo}>
								<Text style={styles.nextRideLabel}>Next Ride Queued</Text>
								<Text style={styles.nextRideText}>
									{nextRide.customerName} • ₦{calculateDriverEarnings(nextRide.amount, nextRide.numberOfPassengers)}
								</Text>
							</View>
						)}

						<TouchableOpacity
							style={styles.collapsibleHeader}
							onPress={() => setShowPendingRides(!showPendingRides)}
							activeOpacity={0.7}
						>
							<Text style={styles.collapsibleTitle}>
								Available Rides ({pendingRides.length})
							</Text>
							<MaterialIcons
								name={showPendingRides ? "keyboard-arrow-up" : "keyboard-arrow-down"}
								size={24}
								color={colors.primaryBlue}
							/>
						</TouchableOpacity>

						{showPendingRides && (
							<View style={styles.pendingRidesContainer}>
								{pendingRides.length === 0 ? (
									<Text style={styles.noPendingText}>No pending rides available</Text>
								) : (
									pendingRides.map((ride) => (
										<View key={ride.rideId} style={styles.pendingRideCard}>
											<View style={styles.pendingRideInfo}>
												<Text style={styles.pendingCustomerName}>
													{ride.customerName || "Customer"}
												</Text>
												<Text style={styles.pendingRideDetails}>
													{typeof ride.pickupLocation === "object"
														? ride.pickupLocation?.name || "Pickup"
														: ride.pickupLocation || "Pickup"} →{" "}
													{typeof ride.destination === "object"
														? ride.destination?.name || "Destination"
														: ride.destination || "Destination"}
												</Text>
												<Text style={styles.pendingRidePrice}>₦{calculateDriverEarnings(ride.amount, ride.numberOfPassengers) || 0}</Text>
											</View>
											<TouchableOpacity
												style={[
													styles.acceptButton,
													(nextRide || accepting === ride.rideId) && styles.acceptButtonDisabled
												]}
												onPress={() => AcceptNextRide(ride.rideId || ride.id)}
												disabled={!!nextRide || accepting === ride.rideId}
											>
												<Text style={styles.acceptButtonText}>
													{accepting === ride.rideId ? "..." : nextRide ? "Queued" : "Accept"}
												</Text>
											</TouchableOpacity>
										</View>
									))
								)}
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
		paddingBottom: sp(40),
		paddingTop: sp(30),
		paddingHorizontal: sp(16),
	},
	menuButton: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		marginBottom: sp(16),
		alignSelf: "flex-start",
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
	nextRideInfo: {
		backgroundColor: colors.primaryBlue + "20",
		padding: sp(12),
		borderRadius: br(8),
		marginBottom: sp(12),
		borderLeftWidth: 4,
		borderLeftColor: colors.primaryBlue,
	},
	nextRideLabel: {
		fontSize: fs(12),
		color: colors.primaryBlue,
		fontWeight: "600",
		marginBottom: sp(4),
	},
	nextRideText: {
		fontSize: fs(14),
		color: "black",
	},
	collapsibleHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: sp(12),
		backgroundColor: colors.lightGrey2,
		borderRadius: br(8),
		marginTop: sp(12),
		marginBottom: sp(8),
	},
	collapsibleTitle: {
		fontSize: fs(16),
		fontWeight: "600",
		color: colors.primaryBlue,
	},
	pendingRidesContainer: {
		marginBottom: sp(12),
	},
	noPendingText: {
		textAlign: "center",
		color: colors.lightGrey3,
		fontSize: fs(14),
		paddingVertical: sp(20),
	},
	pendingRideCard: {
		backgroundColor: "white",
		padding: sp(12),
		borderRadius: br(8),
		marginBottom: sp(8),
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderWidth: 1,
		borderColor: colors.lightGrey2,
	},
	pendingRideInfo: {
		flex: 1,
	},
	pendingCustomerName: {
		fontSize: fs(16),
		fontWeight: "600",
		color: "black",
		marginBottom: sp(4),
	},
	pendingRideDetails: {
		fontSize: fs(12),
		color: colors.lightGrey3,
		marginBottom: sp(4),
	},
	pendingRidePrice: {
		fontSize: fs(14),
		fontWeight: "600",
		color: colors.primaryBlue,
	},
	acceptButton: {
		backgroundColor: colors.primaryBlue,
		paddingHorizontal: sp(16),
		paddingVertical: sp(8),
		borderRadius: br(8),
	},
	acceptButtonDisabled: {
		backgroundColor: colors.lightGrey3,
	},
	acceptButtonText: {
		color: "white",
		fontSize: fs(14),
		fontWeight: "600",
	},
});
