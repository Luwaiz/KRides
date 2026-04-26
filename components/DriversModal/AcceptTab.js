import { StyleSheet, Text, View, TouchableOpacity, Image, Linking, Alert } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { MaterialIcons, Octicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import Phone from "../../assets/svg/Call.svg";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { sp, fs, br } from "../../constants/responsive";
import { useAcceptedRideStore, useDriverDetails } from "../../constants/Store";
import useAuthStore from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import Arrival from "../modals/Arrival";
import { updateRideStatus, listenToPendingRides, declineRide, getRide } from "../../helpers/firebaseRides";
import { getRideCoordinates } from "../../helpers/getLocationCoordinates";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { FIREBASE_DB, FIREBASE_AUTH } from "../../firebaseConfig";
import { NOTIFICATION_API_KEY } from "@env";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { calculateDriverEarnings } from "../../constants/commission";
import { notifyCustomerDriverArrived } from "../../helpers/notificationHelpers";

const AcceptTab = () => {
	const [endRide, setEndRide] = useState(false);
	const [loading, setLoading] = useState(false);
	const [accepting, setAccepting] = useState(null);
	const [showPendingRides, setShowPendingRides] = useState(false);
	const [pendingRides, setPendingRides] = useState([]);
	const [hasArrived, setHasArrived] = useState(false);

	const acceptedRide = useAcceptedRideStore((state) => state.acceptedRide);
	const nextRide = useAcceptedRideStore((state) => state.nextRide);
	const clearAcceptedRide = useAcceptedRideStore((state) => state.clearAcceptedRide);
	const setNextRide = useAcceptedRideStore((state) => state.setNextRide);
	const activateNextRide = useAcceptedRideStore((state) => state.activateNextRide);

	const fullName = useDriverDetails((state) => state.fullName);
	const phone = useDriverDetails((state) => state.phone);
	const VehicleId = useDriverDetails((state) => state.vehicle_id);
	const uid = useDriverDetails((state) => state.uid);
	const bankDetailsVerified = useDriverDetails((state) => state.bankDetailsVerified);

	const navigation = useNavigation();
	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};

	// Listen to pending rides only when the driver is on an active ride
	// (to allow queueing the next ride — not needed when idle, HomeTab handles that)
	useEffect(() => {
		if (!uid || !acceptedRide) return;

		const unsubscribe = listenToPendingRides((rides) => {
			// Filter out rides this driver has declined and limit to 2
			const filteredRides = rides
				.filter(ride => {
					const declinedBy = ride.declined_by || [];
					return !declinedBy.includes(uid);
				})
				.slice(0, 2); // Limit to maximum 2 rides

			setPendingRides(filteredRides);
		}, uid);
		return unsubscribe;
	}, [uid, acceptedRide]);

	const RideEnded = () => {
		if (!acceptedRide?.rideId) return;
		Alert.alert(
			"Complete Ride",
			"Are you sure you want to mark this ride as completed?",
			[
				{ text: "Not yet", style: "cancel" },
				{ text: "Complete", style: "default", onPress: () => doCompleteRide() },
			]
		);
	};

	// Called when driver taps OK on the Arrival/completion modal
	const handleRideCompleteDismiss = () => {
		const queued = nextRide; // capture before state changes
		if (queued) {
			Alert.alert(
				"Next Ride Ready",
				`You have a queued ride from ${queued.customerName || "a customer"}.\n\n${queued.pickupLocation || "Pickup"} → ${queued.destination || "Destination"}\n₦${queued.amount || 0}\n\nStart this ride now?`,
				[
					{
						text: "Decline",
						style: "destructive",
						onPress: async () => {
							setHasArrived(false);
							clearAcceptedRide();
							try {
								await declineRide(queued.rideId, uid);
							} catch (e) {
								console.warn("⚠️ Could not decline queued ride:", e.message);
							}
						},
					},
					{
						text: "Accept",
						onPress: async () => {
							// Re-fetch from Firestore to confirm the ride is still valid.
							// The queued ride may have been cancelled or taken by another
							// driver in the time since the driver queued it.
							const freshRide = await getRide(queued.rideId).catch(() => null);
							if (!freshRide || freshRide.status !== 'accepted' || freshRide.driverId !== uid) {
								Alert.alert(
									"Ride No Longer Available",
									"This queued ride was cancelled or reassigned before you could start it.",
									[{
										text: "OK",
										onPress: () => {
											setNextRide(null);
											clearAcceptedRide();
											setHasArrived(false);
										}
									}]
								);
								return;
							}
							activateNextRide();
							setHasArrived(false);
						},
					},
				],
				{ cancelable: false }
			);
		} else {
			clearAcceptedRide();
			setHasArrived(false);
		}
	};

	const doCompleteRide = async () => {
		setLoading(true);
		try {
			const idToken = await FIREBASE_AUTH.currentUser.getIdToken();
			const response = await fetch('https://krides.onrender.com/api/payments/complete-ride', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': NOTIFICATION_API_KEY || '',
				},
				body: JSON.stringify({ idToken, rideId: acceptedRide.rideId }),
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.error || 'Could not complete ride');
			console.log("✅ Ride completed. Payout:", result.payout ?? 'none');
			setEndRide(true);
		} catch (error) {
			console.error("❌ Error completing ride:", error);
			alert("Unable to complete ride. Please check your connection and try again.");
		} finally {
			setLoading(false);
		}
	};

	// Open navigation to pickup location
	const openNavigation = () => {
		if (!acceptedRide?.pickupCoords) {
			Alert.alert('Error', 'Pickup location not available');
			return;
		}

		const { latitude, longitude } = acceptedRide.pickupCoords;
		const url = `google.navigation:q=${latitude},${longitude}`;

		Linking.canOpenURL(url).then(supported => {
			if (supported) {
				Linking.openURL(url);
			} else {
				// Fallback to Google Maps web
				const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
				Linking.openURL(webUrl);
			}
		}).catch(err => {
			console.error('Error opening navigation:', err);
			Alert.alert('Error', 'Could not open navigation');
		});
	};

	// Notify customer that driver has arrived
	const notifyArrival = () => {
		if (!acceptedRide?.customerId) {
			Alert.alert('Error', 'Customer information not available');
			return;
		}

		Alert.alert(
			"Confirm Arrival",
			"Mark yourself as arrived at the pickup location? This will notify the customer and start the ride.",
			[
				{ text: "Not Yet", style: "cancel" },
				{ text: "Yes, I've Arrived", onPress: doNotifyArrival },
			]
		);
	};

	const doNotifyArrival = async () => {
		try {
			// Use acceptedRide.driverName which was set when accepting the ride
			// Fallback to fullName from store, then to 'Your driver'
			const driverName = acceptedRide.driverName || fullName || 'Your driver';
			console.log('📤 Notifying customer with driver name:', driverName);

			// Update ride status — mark arrived and transition to in_progress
			const rideRef = doc(FIREBASE_DB, 'rides', acceptedRide.rideId);
			await updateDoc(rideRef, {
				hasArrived: true,
				arrivedAt: serverTimestamp(),
				status: 'in_progress',
			});
			console.log('✅ Ride updated with arrival status');

			notifyCustomerDriverArrived(
				acceptedRide.customerId,
				driverName
			).catch(err => console.warn('⚠️ Arrival push notification failed (non-fatal):', err.message));

			setHasArrived(true);
			Alert.alert('Success', 'You have arrived. You can now complete the ride.');
		} catch (error) {
			console.error('Error notifying arrival:', error);
			Alert.alert('Error', 'Could not update arrival status. Please try again.');
		}
	};

	const AcceptNextRide = async (rideId) => {
		if (!uid) {
			alert("Driver account not loaded. Please log out and log back in.");
			return;
		}

		// Check if bank details are verified
		const driverDetails = useDriverDetails.getState();
		if (!driverDetails.bankDetailsVerified) {
			alert(
				"Please complete your bank account details before accepting rides. Go to Settings > Bank Details to add your account information."
			);
			navigation.navigate("BankAccountDetails");
			return;
		}

		if (nextRide) {
			Alert.alert(
				"Queue Full",
				`You already have "${nextRide.customerName || 'a ride'}" queued. Finish your current ride first — the queued ride will be offered to you automatically.`
			);
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
				driverId: uid,
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
				driverId: uid,
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
							<TouchableOpacity
								onPress={() => {
									const customerPhone = acceptedRide?.customerPhone;
									if (customerPhone) Linking.openURL(`tel:${customerPhone}`);
								}}
								disabled={!acceptedRide?.customerPhone}
							>
								<Phone width={24} height={24} />
							</TouchableOpacity>
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
								{(!acceptedRide.pickupCoords || !acceptedRide.destinationCoords) && (
									<TouchableOpacity
										style={styles.retryMapBtn}
										onPress={() => {
											const pickup = acceptedRide.pickupLocation || acceptedRide.location;
											const dest = acceptedRide.destination;
											getRideCoordinates(pickup, dest)
												.then(({ pickup: p, destination: d }) => {
													useAcceptedRideStore.getState().updateRideCoords(p, d);
												})
												.catch(() => Alert.alert("Error", "Could not load map route. Check your connection."));
										}}
									>
										<Text style={styles.retryMapText}>Retry map route</Text>
									</TouchableOpacity>
								)}
							</View>
						)}

						{nextRide && (
							<View style={styles.nextRideInfo}>
								<Text style={styles.nextRideLabel}>Next Ride Queued</Text>
								<Text style={styles.nextRideText}>
									{nextRide.customerName} • ₦{calculateDriverEarnings(nextRide.amount, nextRide.numberOfPassengers)}
								</Text>
								{(nextRide.pickupLocation || nextRide.location) ? (
									<Text style={styles.nextRidePickup} numberOfLines={1}>
										From: {nextRide.pickupLocation || nextRide.location}
									</Text>
								) : null}
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
								{!bankDetailsVerified && (
									<View style={styles.bankWarning}>
										<MaterialIcons name="warning" size={16} color="#b45309" />
										<Text style={styles.bankWarningText}>
											Add bank details to accept queued rides.{' '}
											<Text style={styles.bankWarningLink} onPress={() => navigation.navigate('BankAccountDetails')}>
												Set up now
											</Text>
										</Text>
									</View>
								)}
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

						{/* I've Arrived Button */}
						<TouchableOpacity
							style={[
								styles.arrivalButton,
								hasArrived && styles.arrivalButtonDisabled
							]}
							onPress={notifyArrival}
							activeOpacity={0.7}
							disabled={hasArrived}
						>
							<MaterialIcons name="location-on" size={20} color="#fff" />
							<Text style={styles.arrivalButtonText}>
								{hasArrived ? "Arrived ✓" : "I've Arrived"}
							</Text>
						</TouchableOpacity>

						<View style={styles.button}>
							<ActiveButton
								title={"Complete Ride"}
								onPress={RideEnded}
								loading={loading}
								disabled={!hasArrived}
							/>
						</View>
					</View>
				</BottomSheetScrollView>
			</BottomSheet>
			<Arrival modal={endRide} setModal={setEndRide} onDismiss={handleRideCompleteDismiss} />
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
	nextRidePickup: {
		fontSize: fs(12),
		color: colors.lightGrey3,
		marginTop: sp(2),
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
	arrivalButton: {
		backgroundColor: '#4caf50',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: sp(14),
		borderRadius: br(10),
		marginTop: sp(16),
		gap: sp(8),
	},
	arrivalButtonDisabled: {
		backgroundColor: colors.lightGrey3,
	},
	arrivalButtonText: {
		color: '#fff',
		fontSize: fs(16),
		fontWeight: '600',
	},
	retryMapBtn: {
		marginTop: sp(8),
		alignSelf: 'flex-start',
	},
	retryMapText: {
		fontSize: fs(12),
		fontFamily: 'Albert-SemiBold',
		color: colors.primaryBlue,
		textDecorationLine: 'underline',
	},
	bankWarning: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: sp(8),
		backgroundColor: '#fef3c7',
		borderRadius: br(8),
		padding: sp(10),
		marginBottom: sp(8),
	},
	bankWarningText: {
		flex: 1,
		fontSize: fs(13),
		color: '#92400e',
	},
	bankWarningLink: {
		fontFamily: 'Albert-SemiBold',
		textDecorationLine: 'underline',
	},
});
