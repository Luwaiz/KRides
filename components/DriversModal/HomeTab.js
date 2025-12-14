import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	View,
	TouchableOpacity,
	RefreshControl,
} from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import React, { useEffect, useState, useRef } from "react";
import Geolocation from "@react-native-community/geolocation";
import { Feather } from "@expo/vector-icons";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import {
	useBottomTabStore,
	useDriverDetails,
	useAcceptedRideStore,
	useDriverAvailability,
} from "../../constants/Store";
import useAuthStore from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import DangerButton from "../buttons/DangerButton";
import Destination from "../Destination";
import RideRequestModal from "../modals/RideRequestModal";
import axios from "axios";
import API from "../../hooks/API";
import { getRideCoordinates } from "../../helpers/getLocationCoordinates";
import { listenToPendingRides, declineRide } from "../../helpers/firebaseRides";
import { notifyCustomerRideAccepted } from "../../helpers/notificationHelpers";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";
import { sp, fs, br, ms } from "../../constants/responsive";
import { useNavigation } from "@react-navigation/native";

const HomeTab = () => {
	const accessToken = useDriverDetails((state) => state.accessToken);
	const VehicleId = useDriverDetails((state) => state.vehicle_id);
	const fullName = useDriverDetails((state) => state.fullName);
	const phone = useDriverDetails((state) => state.phone);
	const uid = useDriverDetails((state) => state.uid);

	console.log("🚗 Driver store state:");
	console.log("   - fullName:", fullName || "MISSING");
	console.log("   - vehicle_id:", VehicleId || "MISSING");
	console.log("   - phone:", phone || "MISSING");
	console.log("   - uid:", uid || "MISSING");

	const navigation = useNavigation();

	const setAcceptedRide = useAcceptedRideStore(
		(state) => state.setAcceptedRide
	);
	const setAcceptRidePage = useBottomTabStore(
		(state) => state.setAcceptRidePage
	);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [accepting, setAccepting] = useState(null);
	const [declining, setDeclining] = useState(null);
	const [rides, setRides] = useState([]);
	const [currentRideRequest, setCurrentRideRequest] = useState(null);
	const [showRideModal, setShowRideModal] = useState(false);

	// ✅ Listen to pending rides from Firestore (real-time)
	useEffect(() => {
		console.log("🔍 Setting up Firestore listener for pending rides...");
		setLoading(true);

		const unsubscribe = listenToPendingRides((pendingRides) => {
			console.log("📨 Received pending rides:", pendingRides.length);
			setRides(pendingRides);
			setLoading(false);
		}, uid); // Pass driver ID to filter out declined rides

		return () => {
			console.log("🔌 Cleaning up pending rides listener");
			unsubscribe();
		};
	}, [uid]);

	// Show modal for first ride when rides update
	useEffect(() => {
		const isOnline = useDriverAvailability.getState().isOnline;

		// Don't show modal if driver is offline
		if (!isOnline) {
			setShowRideModal(false);
			setCurrentRideRequest(null);
			return;
		}

		// Only show modal if:
		// 1. There are rides available
		// 2. No modal is currently showing
		// 3. No current ride request is set
		// 4. Not currently accepting a ride
		if (rides.length > 0 && !showRideModal && !currentRideRequest && !accepting) {
			const firstRide = rides[0];
			// Make sure we're not showing the same ride again
			if (!currentRideRequest || currentRideRequest.rideId !== firstRide.rideId) {
				console.log('🔔 New ride available, showing modal:', firstRide.rideId);
				setCurrentRideRequest(firstRide);
				setShowRideModal(true);
			}
		}
	}, [rides, showRideModal, currentRideRequest, accepting]);

	const onRefresh = () => {
		console.log("🔄 Manual refresh - Firestore listeners auto-update");
		// Firestore listeners automatically update, but we can show refreshing state
		setRefreshing(true);
		setTimeout(() => setRefreshing(false), 1000);
	};

	// ❌ Decline ride
	const DeclineRide = async (rideId) => {
		console.log("❌ Declining ride:", rideId);
		setDeclining(rideId);

		try {
			await declineRide(rideId, uid);
			console.log("✅ Ride declined successfully");
			// Ride will automatically disappear from list via listener
		} catch (error) {
			console.error("❌ Error declining ride:", error);

			let errorMessage = "Unable to decline ride. Please try again.";
			if (error.message?.includes("not found")) {
				errorMessage = "This ride is no longer available.";
			}

			alert(errorMessage);
		} finally {
			setDeclining(null);
		}
	};

	// Handle modal accept
	const handleModalAccept = async (rideId) => {
		console.log('✅ Modal accept - closing modal and clearing current request');
		// Immediately close modal and clear current ride to prevent re-showing
		setShowRideModal(false);
		setCurrentRideRequest(null);
		await AcceptRide(rideId);
	};

	// Handle modal decline
	const handleModalDecline = async (rideId) => {
		console.log('❌ Modal decline - closing modal and clearing current request');
		setShowRideModal(false);
		setCurrentRideRequest(null);
		await DeclineRide(rideId);
	};

	// Handle modal timeout
	const handleModalTimeout = async (rideId) => {
		console.log("⏰ Ride request timed out:", rideId);
		// Auto-decline uses the same logic as manual decline
		await handleModalDecline(rideId);
	};

	// ✅ Accept ride using Firestore
	const AcceptRide = async (rideId) => {
		// Check if bank details are verified
		const driverDetails = useDriverDetails.getState();
		if (!driverDetails.bankDetailsVerified) {
			alert(
				"Please complete your bank account details before accepting rides. Go to Settings > Bank Details to add your account information."
			);
			navigation.navigate("BankAccountDetails");
			return;
		}

		console.log("🚗 Accepting ride:", rideId);
		console.log("   Driver details:");
		console.log("   - Full Name:", fullName || "MISSING");
		console.log("   - Phone:", phone || "MISSING");
		console.log("   - Vehicle ID:", VehicleId || "MISSING");
		console.log("   - UID:", uid || "MISSING");

		setAccepting(rideId);

		try {
			// Find the ride from the list to get full details
			const rideDetails = rides.find((r) => (r.rideId || r.id) === rideId);

			if (!rideDetails) {
				throw new Error("Ride not found in list");
			}

			// Fetch coordinates from Firestore based on location names
			const { pickup, destination } = await getRideCoordinates(
				rideDetails.pickupLocation,
				rideDetails.destination
			);

			const driverData = {
				driverId: uid || VehicleId,
				driverName: fullName || "Driver",
				driverPhone: phone || "",
				vehicleId: VehicleId || "",
			};

			console.log("📤 Updating ride status in Firestore directly");

			// Accept the ride via direct Firestore update
			const rideRef = doc(FIREBASE_DB, "rides", rideId);
			await updateDoc(rideRef, {
				status: "accepted",
				driverId: uid || VehicleId,
				driverName: fullName || "Driver",
				driverPhone: phone || "",
				vehicleId: VehicleId || "",
				acceptedAt: serverTimestamp(),
			});

			// Notify customer that ride was accepted
			await notifyCustomerRideAccepted(
				rideDetails.customerId,
				rideId,
				fullName || "Driver"
			);

			// Store the accepted ride details with coordinates
			setAcceptedRide({
				...rideDetails,
				rideId: rideId, // Ensure rideId is stored
				pickupCoords: pickup,
				destinationCoords: destination,
				driverId: uid || VehicleId,
				driverName: fullName || "Driver",
			});

			console.log(
				"✅ Ride accepted successfully with driver name:",
				fullName || "Driver"
			);

			// Add a small delay to ensure smooth transition and prevent flashing of the previous screen
			setTimeout(() => {
				// Switch to AcceptTab to show the "Complete Ride" button
				setAcceptRidePage();
				console.log("🔄 Switched to AcceptTab");
				setAccepting(null);
			}, 500);

			// Remove from pending list (will be handled by listener automatically)
		} catch (error) {
			console.error("❌ Error accepting ride:", error);

			// User-friendly error message
			let errorMessage = "Unable to accept ride. Please try again.";

			if (error.message?.includes("not found")) {
				errorMessage = "This ride is no longer available.";
			} else if (
				error.message?.includes("network") ||
				error.message?.includes("connection")
			) {
				errorMessage =
					"Network error. Please check your connection and try again.";
			}

			alert(errorMessage);
			setAccepting(null);
		}
	};

	// Optional: Track driver location (can be used for live tracking feature later)
	useEffect(() => {
		const watchId = Geolocation.watchPosition(
			(position) => {
				const coords = {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				};
				// Store or emit location updates if needed
				console.log("📍 Driver location:", coords);
			},
			(error) => {
				console.warn("⚠️ Location tracking error:", error);
			},
			{ enableHighAccuracy: true, distanceFilter: 10, interval: 10000 }
		);

		return () => {
			try {
				Geolocation.clearWatch(watchId);
				console.log("🛑 Stopped location tracking");
			} catch (e) {
				console.warn("Error clearing location watch:", e);
			}
		};
	}, []);

	return (
		<>
			{/* Full-screen ride request modal */}
			<RideRequestModal
				visible={showRideModal}
				ride={currentRideRequest}
				onAccept={handleModalAccept}
				onDecline={handleModalDecline}
				onTimeout={handleModalTimeout}
			/>

			<BottomSheet
				snapPoints={rides.length > 1 ? ["76%"] : ["50%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				{loading ? (
					<ActivityIndicator />
				) : (
					<View style={styles.sheetCont}>
						<View style={styles.topText}>
							<Text style={styles.where}>Ride request</Text>
							<TouchableOpacity onPress={onRefresh} disabled={refreshing}>
								<Feather
									name="refresh-cw"
									size={ms(24)}
									color={refreshing ? colors.lightGrey3 : colors.primaryBlue}
								/>
							</TouchableOpacity>
						</View>
						{rides?.length === 0 ? (
							<View style={styles.noRidesContainer}>
								<Text style={styles.noRides}>No pending rides</Text>
								<TouchableOpacity
									onPress={onRefresh}
									style={styles.refreshButton}
								>
									<Text style={styles.refreshButtonText}>Refresh</Text>
								</TouchableOpacity>
							</View>
						) : (
							<BottomSheetFlatList
								data={rides}
								extraData={accepting}
								refreshControl={
									<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
								}
								keyExtractor={(item) =>
									item?.rideId?.toString() ?? Math.random().toString()
								}
								renderItem={({ item }) => (
									<View style={styles.container}>
										<View style={styles.details}>
											<Avatar width={50} height={50} />
											<View>
												<Text style={styles.name}>
													{item?.customerName || item?.name || "Unknown"}
												</Text>
												<Text style={styles.time}>
													Passengers:{" "}
													{item?.numberOfPassengers ||
														item?.number_of_passengers ||
														1}
												</Text>
												<Text style={styles.time}>₦{item?.amount || 0}</Text>
											</View>
										</View>
										<Destination
											location={item?.pickupLocation || item?.location}
											destination={item?.destination}
										/>
										<View style={styles.button}>
											<DangerButton
												title={"Decline"}
												onPress={() => DeclineRide(item?.rideId || item?.id)}
												loading={declining === (item?.rideId || item?.id)}
											/>
											<ActiveButton
												title={"Accept"}
												onPress={() => AcceptRide(item?.rideId || item?.id)}
												loading={accepting === (item?.rideId || item?.id)}
											/>
										</View>
									</View>
								)}
							/>
						)}
					</View>
				)}
			</BottomSheet>
		</>
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
	container: {
		marginBottom: sp(30),
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
	},
	where: {
		fontSize: fs(24),
		fontWeight: "bold",
		color: "black",
	},
	name: {
		fontFamily: "Albert-SemiBold",
		fontSize: fs(16),
	},
	button: {
		marginTop: sp(20),
		flexDirection: "row",
		justifyContent: "space-between",
	},
	noRides: {
		fontSize: fs(16),
		color: colors.lightGrey3,
		textAlign: "center",
		marginTop: sp(20),
	},
	noRidesContainer: {
		alignItems: "center",
		marginTop: sp(40),
	},
	refreshButton: {
		marginTop: sp(20),
		paddingHorizontal: sp(20),
		paddingVertical: sp(10),
		backgroundColor: colors.primaryBlue,
		borderRadius: br(8),
	},
	refreshButtonText: {
		color: "white",
		fontSize: fs(16),
		fontWeight: "600",
	},
	errorText: {
		fontSize: fs(14),
		color: "#ff3b30",
		textAlign: "center",
		marginVertical: sp(10),
		paddingHorizontal: sp(16),
	},
});

