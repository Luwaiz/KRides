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
} from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import DangerButton from "../buttons/DangerButton";
import Destination from "../Destination";
import axios from "axios";
import API from "../../hooks/API";
import { getRideCoordinates } from "../../helpers/getLocationCoordinates";
import { listenToPendingRides } from "../../helpers/firebaseRides";
import { httpsCallable } from "firebase/functions";
import { FIREBASE_FUNCTIONS } from "../../firebaseConfig";
import { sp, fs, br, ms } from "../../constants/responsive";

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

	const setAcceptedRide = useAcceptedRideStore(
		(state) => state.setAcceptedRide
	);
	const setAcceptRidePage = useBottomTabStore(
		(state) => state.setAcceptRidePage
	);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [accepting, setAccepting] = useState(null);
	const [rides, setRides] = useState([]);

	// ✅ Listen to pending rides from Firestore (real-time)
	useEffect(() => {
		console.log("🔍 Setting up Firestore listener for pending rides...");
		setLoading(true);

		const unsubscribe = listenToPendingRides((pendingRides) => {
			console.log("📨 Received pending rides:", pendingRides.length);
			setRides(pendingRides);
			setLoading(false);
		});

		return () => {
			console.log("🔌 Cleaning up pending rides listener");
			unsubscribe();
		};
	}, []);

	const onRefresh = () => {
		console.log("🔄 Manual refresh - Firestore listeners auto-update");
		// Firestore listeners automatically update, but we can show refreshing state
		setRefreshing(true);
		setTimeout(() => setRefreshing(false), 1000);
	};

	// ✅ Accept ride using Firestore
	const AcceptRide = async (rideId) => {
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

			console.log("📤 Sending driver data to Firestore via Cloud Function");

			// Accept the ride via Cloud Function
			const acceptRideFn = httpsCallable(FIREBASE_FUNCTIONS, "acceptRide");
			await acceptRideFn({ rideId });

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

			// Switch to AcceptTab to show the "Complete Ride" button
			setAcceptRidePage();
			console.log("🔄 Switched to AcceptTab");

			setAccepting(null);

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
										<DangerButton title={"Decline"} />
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
