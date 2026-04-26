import {
	ActivityIndicator,
	Alert,
	Animated,
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
import Toast from "react-native-toast-message";
import axios from "axios";
import API from "../../hooks/API";
import { getRideCoordinates } from "../../helpers/getLocationCoordinates";
import { listenToPendingRides, declineRide } from "../../helpers/firebaseRides";
import { notifyCustomerRideAccepted } from "../../helpers/notificationHelpers";
import { doc, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { FIREBASE_DB } from "../../firebaseConfig";
import { sp, fs, br, ms } from "../../constants/responsive";
import { useNavigation } from "@react-navigation/native";

const HomeTab = () => {
	const accessToken = useDriverDetails((state) => state.accessToken);
	const VehicleId = useDriverDetails((state) => state.vehicle_id);
	const fullName = useDriverDetails((state) => state.fullName);
	const phone = useDriverDetails((state) => state.phone);
	const uid = useDriverDetails((state) => state.uid);

	const navigation = useNavigation();

	const setAcceptedRide = useAcceptedRideStore(
		(state) => state.setAcceptedRide
	);
	const setAcceptRidePage = useBottomTabStore(
		(state) => state.setAcceptRidePage
	);
	const isOnline = useDriverAvailability((state) => state.isOnline);
	const setOnline = useDriverAvailability((state) => state.setOnline);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [accepting, setAccepting] = useState(null);
	const [declining, setDeclining] = useState(null);
	const [rides, setRides] = useState([]);
	const [currentRideRequest, setCurrentRideRequest] = useState(null);
	const [showRideModal, setShowRideModal] = useState(false);
	const processedRideIds = useRef(new Set());
	const pulseAnim = useRef(new Animated.Value(1)).current;

	// Pulse animation for the listening indicator — runs while the list is empty
	useEffect(() => {
		if (rides.length > 0 || !isOnline) {
			pulseAnim.setValue(1);
			return;
		}
		const pulse = Animated.loop(
			Animated.sequence([
				Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
				Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
			])
		);
		pulse.start();
		return () => pulse.stop();
	}, [rides.length, isOnline]);

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
			const firstRide = rides.find(r => !processedRideIds.current.has(r.rideId));
			if (firstRide) {
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
			Toast.show({
				type: "tomatoToast",
				text1: "Ride Declined",
				text2: "The ride has been removed from your list.",
				position: "top",
				visibilityTime: 2500,
			});
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
		processedRideIds.current.add(rideId);
		setShowRideModal(false);
		setCurrentRideRequest(null);
		await AcceptRide(rideId);
	};

	// Handle modal decline
	const handleModalDecline = async (rideId) => {
		console.log('❌ Modal decline - closing modal and clearing current request');
		processedRideIds.current.add(rideId);
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

	// ✅ Accept ride — atomic Firestore transaction prevents double-acceptance
	const AcceptRide = async (rideId) => {
		if (!uid) {
			alert("Driver account not loaded. Please log out and log back in.");
			return;
		}

		const driverDetails = useDriverDetails.getState();
		if (!driverDetails.accountNumber) {
			Alert.alert(
				"Bank Details Required",
				"You need to add your bank account details before accepting rides so you can receive payments.",
				[
					{ text: "Later", style: "cancel" },
					{ text: "Set Up Now", onPress: () => navigation.navigate("BankAccountDetails") },
				]
			);
			return;
		}

		if (!useDriverAvailability.getState().isOnline) {
			Alert.alert(
				"You're Offline",
				"You need to be online to accept rides. Switch online now?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Go Online & Accept",
						onPress: async () => {
							setOnline();
							const driverRef = doc(FIREBASE_DB, "drivers", uid);
							await updateDoc(driverRef, { isOnline: true, lastStatusChange: serverTimestamp() }).catch(() => {});
							AcceptRide(rideId);
						},
					},
				]
			);
			return;
		}

		const rideDetails = rides.find((r) => (r.rideId || r.id) === rideId);
		if (!rideDetails) {
			alert("This ride is no longer available.");
			return;
		}

		setAccepting(rideId); // shows spinner on the Accept button

		// Atomic transaction: read current state, verify still pending, then write.
		// If another driver accepted first, the transaction throws and we abort.
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		try {
			await runTransaction(FIREBASE_DB, async (txn) => {
				const snap = await txn.get(rideRef);
				if (!snap.exists()) throw new Error("RIDE_NOT_FOUND");
				const data = snap.data();
				if (data.status !== "pending" || (data.driverId && data.driverId !== "")) {
					throw new Error("RIDE_TAKEN");
				}
				txn.update(rideRef, {
					status: "accepted",
					driverId: uid,
					driverName: fullName || "Driver",
					driverPhone: phone || "",
					vehicleId: VehicleId || "",
					acceptedAt: serverTimestamp(),
				});
			});
		} catch (err) {
			setAccepting(null);
			if (err.message === "RIDE_TAKEN") {
				Alert.alert("Ride Taken", "Another driver accepted this ride first. Please choose another ride.");
			} else if (err.message === "RIDE_NOT_FOUND") {
				Alert.alert("Not Available", "This ride is no longer available.");
			} else {
				Alert.alert("Connection Error", "Could not accept the ride. Please check your connection and try again.");
			}
			return;
		}

		// Transaction succeeded — switch UI
		setAcceptedRide({
			...rideDetails,
			rideId,
			pickupCoords: null,
			destinationCoords: null,
			driverId: uid,
			driverName: fullName || "Driver",
		});
		setAcceptRidePage();
		setAccepting(null);

		// Background: fetch coords and notify customer
		const fetchCoords = () =>
			getRideCoordinates(rideDetails.pickupLocation, rideDetails.destination)
				.then(({ pickup, destination }) => {
					useAcceptedRideStore.getState().updateRideCoords(pickup, destination);
				});
		fetchCoords().catch(() => {
			setTimeout(() => fetchCoords().catch((err) =>
				console.warn("⚠️ Could not fetch ride coords after retry:", err.message)
			), 5000);
		});

		notifyCustomerRideAccepted(rideDetails.customerId, rideId, fullName || "Driver")
			.catch((err) => console.warn("⚠️ Customer notification failed:", err.message));

		console.log("✅ Ride accepted atomically, switched to AcceptTab");
	};

	// Track driver location — only while online
	useEffect(() => {
		if (!uid || !isOnline) return;

		const watchId = Geolocation.watchPosition(
			(position) => {
				const driverRef = doc(FIREBASE_DB, "drivers", uid);
				updateDoc(driverRef, {
					location: {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					},
					locationUpdatedAt: serverTimestamp(),
				}).catch(() => {});
			},
			(error) => {
				console.warn("⚠️ Location tracking error:", error);
			},
			{ enableHighAccuracy: true, distanceFilter: 10, interval: 10000 }
		);

		return () => {
			try {
				Geolocation.clearWatch(watchId);
			} catch (e) {
				console.warn('⚠️ Geolocation.clearWatch failed:', e.message);
			}
		};
	}, [uid, isOnline]);

	return (
		<>
			<RideRequestModal
				visible={showRideModal}
				ride={currentRideRequest}
				onAccept={handleModalAccept}
				onDecline={handleModalDecline}
				onTimeout={handleModalTimeout}
			/>

			<BottomSheet
				snapPoints={["76%"]}
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
								{isOnline ? (
									<>
										<Animated.View style={[styles.listeningDot, { opacity: pulseAnim }]} />
										<Text style={styles.listeningText}>Listening for ride requests...</Text>
										<Text style={styles.listeningSubtext}>
											You'll be notified as soon as a customer nearby requests a ride.
										</Text>
									</>
								) : (
									<>
										<View style={styles.offlineDot} />
										<Text style={styles.noRides}>You're offline</Text>
										<Text style={styles.listeningSubtext}>
											Go online using the toggle above to start receiving ride requests.
										</Text>
									</>
								)}
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
		marginTop: sp(12),
	},
	noRidesContainer: {
		alignItems: "center",
		marginTop: sp(40),
		paddingHorizontal: sp(24),
	},
	listeningDot: {
		width: ms(14),
		height: ms(14),
		borderRadius: ms(7),
		backgroundColor: "#4caf50",
		marginBottom: sp(12),
	},
	offlineDot: {
		width: ms(14),
		height: ms(14),
		borderRadius: ms(7),
		backgroundColor: colors.lightGrey3,
		marginBottom: sp(12),
	},
	listeningText: {
		fontSize: fs(16),
		fontFamily: "Albert-SemiBold",
		color: "#333",
		textAlign: "center",
		marginBottom: sp(6),
	},
	listeningSubtext: {
		fontSize: fs(13),
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
		textAlign: "center",
		marginBottom: sp(20),
		lineHeight: fs(20),
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
	acceptingOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0,0,0,0.55)",
		justifyContent: "center",
		alignItems: "center",
		zIndex: 9999,
		gap: sp(14),
	},
	acceptingText: {
		color: "white",
		fontSize: fs(16),
		fontFamily: "Albert-SemiBold",
	},
});

