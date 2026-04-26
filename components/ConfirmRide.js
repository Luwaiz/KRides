import { StyleSheet, Text, TouchableOpacity, View, Alert, Linking, ActivityIndicator, Modal } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import React, { useEffect, useState, useMemo, useRef } from "react";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import Avatar from "../assets/svg/Frame 77avatar.svg";
import Phone from "../assets/svg/Call.svg";
import Star from "../assets/svg/Rating.svg";
import Direction from "../assets/svg/Frame 34direction.svg";
import Naira from "../assets/svg/Naira.svg";
import RideConfirm from "./modals/RideConfirm";
import RatingModal from "./modals/RatingModal";
import { sp, fs, br, ms } from "../constants/responsive";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	useRideStore,
	useUserDetails,
	useRideDetailsStore,
	useBottomTabStore,
	useActiveRideStore,
} from "../constants/Store";
import InActiveButton from "./buttons/InActiveButton";
import DangerButton from "./buttons/DangerButton";
import Payment from "../screens/AppScreens/Payment";
import { createRide, listenToRide, cancelRide, getRide } from "../helpers/firebaseRides";
import { calculateDistance, calculateFare } from "../helpers/rideCalculations";
import { FIREBASE_DB, FIREBASE_AUTH } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import useAuthStore from "../constants/Store";
import { notifyDriverRideCancelled } from "../helpers/notificationHelpers";

const ConfirmRide = () => {
	const [selectRider, setSelectRider] = useState(false);
	const [loading, setLoading] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [rideId, setRideId] = useState(null);
	const [acceptedDriverName, setAcceptedDriverName] = useState("");
	const [showRatingModal, setShowRatingModal] = useState(false);
	const bookingInFlight = useRef(false);
	const activeRide = useActiveRideStore((state) => state.activeRide);
	const rideStatus = useActiveRideStore((state) => state.rideStatus);
	const setHomePage = useBottomTabStore((state) => state.setHomePage);
	const clearAuth = useAuthStore((state) => state.clearAuth);
	const clearUser = useUserDetails((state) => state.clearUser);

	const currentTime = new Date();

	const { destination, location, rider, numberOfPassenger } = useRideStore(
		(state) => ({
			destination: state.destination,
			location: state.location,
			rider: state.rider,
			numberOfPassenger: state.numberOfPassenger,
		})
	);

	const { setRider } = useRideStore((state) => ({
		setRider: state.setRider,
	}));

	const { pickupLocation, destination: destinationCoords } =
		useRideDetailsStore((state) => ({
			pickupLocation: state.pickupLocation,
			destination: state.destination,
		}));

	const { firstName, lastName, email, phone, UserId } = useUserDetails(
		(state) => ({
			firstName: state.firstName,
			lastName: state.lastName,
			email: state.email,
			phone: state.phone,
			UserId: state.UserId,
		})
	);

	const Price = useMemo(() => {
		if (!pickupLocation || !destinationCoords) return 0;
		const dist = calculateDistance(
			{ latitude: pickupLocation.latitude, longitude: pickupLocation.longitude },
			{ latitude: destinationCoords.latitude, longitude: destinationCoords.longitude }
		);
		return calculateFare(dist, parseInt(numberOfPassenger));
	}, [pickupLocation, destinationCoords, numberOfPassenger]);


	// ✅ Create a new ride using Firebase helper
	const BookRide = async (transactionId = null) => {
		setLoading(true);
		const currentUser = FIREBASE_AUTH.currentUser;

		// Validation: Check if user is logged in
		if (!UserId) {
			setLoading(false);
			Alert.alert(
				"Session Expired",
				"Please log in to book a ride.",
				[
					{
						text: "OK",
						onPress: async () => {
							try {
								await signOut(FIREBASE_AUTH);
								clearAuth();
								clearUser();
							} catch (error) {
								console.error("❌ Logout error:", error);
							}
						},
					},
				],
				{ cancelable: false }
			);
			return;
		}

		// Validation: Check if Firebase Auth user matches store user
		if (!currentUser || currentUser.uid !== UserId) {
			setLoading(false);
			Alert.alert(
				"Authentication Error",
				"Your session is out of sync. Please log in again.",
				[
					{
						text: "OK",
						onPress: async () => {
							try {
								await signOut(FIREBASE_AUTH);
								clearAuth();
								clearUser();
							} catch (error) {
								console.error("❌ Logout error:", error);
							}
						},
					},
				],
				{ cancelable: false }
			);
			return;
		}

		// Validation before booking
		if (!pickupLocation || !destinationCoords) {
			setLoading(false);
			alert("Missing location information. Please go back and select pickup and destination again.");
			return;
		}

		if (!numberOfPassenger) {
			setLoading(false);
			alert("Please select number of passengers.");
			return;
		}

		// Validation: Check if user profile data is loaded
		if (!email || !firstName) {
			console.log("⚠️ Warning: User profile data incomplete");
			console.log("   - Email:", email || "MISSING");
			console.log("   - First Name:", firstName || "MISSING");
			console.log("   - Last Name:", lastName || "MISSING");
			setLoading(false);
			Alert.alert(
				"Profile Incomplete",
				"Some of your profile information couldn't be loaded. This is usually temporary.\n\nDo you want to continue booking anyway?",
				[
					{ text: "Cancel", style: "cancel" },
					{ text: "Continue Anyway", onPress: () => continueBooking(transactionId) },
				]
			);
			return;
		}

		await continueBooking(transactionId);
	};

	const continueBooking = async (transactionId = null) => {
		if (bookingInFlight.current) return;
		bookingInFlight.current = true;
		setLoading(true);
		// Clear any deferred rating reminder so it doesn't pop up mid-new-ride
		AsyncStorage.removeItem('pending_customer_rating').catch(() => {});
		try {
			const rideData = {
				customerId: UserId,
				customerName:
					`${firstName || ""} ${lastName || ""}`.trim() || "Customer",
				customerPhone: phone || "N/A",
				pickupLocation: location,
				pickupCoords: pickupLocation,
				destination: destination,
				destinationCoords: destinationCoords,
				numberOfPassengers: numberOfPassenger,
				amount: Price,
				paymentMethod: "flutterwave",
				transactionId: transactionId,
			};
			const newRideId = await createRide(rideData);
			console.log("✅ Ride created successfully! Ride ID:", newRideId);

			setRideId(newRideId);


			// Set active ride in store so status bar appears
			console.log("Setting active ride in store...");
			useActiveRideStore.getState().setActiveRide({
				rideId: newRideId,
				status: 'pending',
				driverName: null,
				driverId: null,
				driverPhone: null,
				vehicleId: null,
				hasArrived: false,
			});

			// Show booking confirmation toast before navigating
			Toast.show({
				type: "tomatoToast",
				text1: "Ride Booked!",
				text2: "Searching for a driver near you...",
				position: "top",
				visibilityTime: 3000,
			});

			// Navigate to home immediately after booking
			console.log("🏠 Navigating to home page...");
			setHomePage();
		} catch (error) {
			console.error("❌ Error creating ride:", error);
			if (error.code === "permission-denied") {
				Alert.alert(
					"Firebase Permission Error",
					"The Firestore security rules are blocking ride creation. This is a Firebase Console configuration issue, not an app issue.\n\nPlease:\n1. Open Firebase Console\n2. Go to Firestore → Rules\n3. Update and publish the security rules.",
					[{ text: "OK" }]
				);
			} else if (
				error.name === "AbortError" ||
				error.message?.toLowerCase().includes("network") ||
				error.message?.toLowerCase().includes("internet") ||
				error.code === "unavailable"
			) {
				Alert.alert(
					"No Internet Connection",
					"Please check your connection and try again.",
					[{ text: "OK" }]
				);
			} else {
				alert("Failed to create ride. Please try again.");
			}
		} finally {
			bookingInFlight.current = false;
			setLoading(false);
		}
	};


	// ❌ Cancel ride with confirmation dialog
	const handleCancelRide = () => {
		const cancelRideId = activeRide?.rideId || rideId;
		if (!cancelRideId) {
			alert("No active ride to cancel");
			return;
		}

		// Show confirmation dialog
		Alert.alert(
			"Cancel Ride",
			rideStatus === "accepted"
				? "A driver has already accepted your ride. Are you sure you want to cancel?"
				: "Are you sure you want to cancel this ride?",
			[
				{
					text: "No, Keep Ride",
					style: "cancel",
				},
				{
					text: "Yes, Cancel",
					style: "destructive",
					onPress: async () => {
						setCancelling(true);
						try {
							const rideSnapshot = await getRide(cancelRideId);
							await cancelRide(cancelRideId);
							console.log("✅ Ride cancelled successfully");

							// Notify driver if one had already accepted
							if (rideSnapshot?.driverId) {
								notifyDriverRideCancelled(
									rideSnapshot.driverId,
									cancelRideId,
									`${firstName} ${lastName}`.trim() || 'Customer'
								).catch(() => {});
							}

							// Reset local states
							setSelectRider(false);
							setRideId(null);
							setAcceptedDriverName("");

							// Navigate back to home
							setHomePage();

							Toast.show({
								type: "tomatoToast",
								text1: "Ride Cancelled",
								text2: "Your ride has been cancelled successfully",
								position: "top",
								visibilityTime: 3000,
							});
						} catch (error) {
							console.error("❌ Error cancelling ride:", error);
							Toast.show({
								type: "tomatoToast",
								text1: "Cancellation Failed",
								text2: "Unable to cancel ride. Please try again",
								position: "top",
								visibilityTime: 3000,
							});
						} finally {
							setCancelling(false);
						}
					},
				},
			]
		);
	};

	return (
		<>
			<BottomSheet
				snapPoints={["50%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				<View style={styles.bottomCont}>
					{/* Driver section */}
					<View style={styles.callDriver}>
						<Avatar width={50} height={50} />
						<View style={styles.driverDetails}>
							<Text style={styles.driverName}>
								{rider ? rider : "No driver assigned yet"}
							</Text>
						</View>
						<TouchableOpacity
							style={styles.phoneCont}
							onPress={() => {
								const phone = activeRide?.driverPhone;
								if (phone) Linking.openURL(`tel:${phone}`);
							}}
							disabled={!activeRide?.driverPhone}
						>
							<Phone width={25} height={25} />
						</TouchableOpacity>
					</View>

					{/* Pickup/Destination */}
					<View style={styles.locationCont}>
						<Direction width={40} height={80} />
						<View style={styles.places}>
							<View style={styles.location}>
								<Text style={styles.locationText}>
									{location || "Pickup not found"}
								</Text>
							</View>
							<View style={styles.location}>
								<Text style={styles.locationText}>
									{destination || "Destination not found"}
								</Text>
							</View>
						</View>
					</View>

					{/* Payment */}
					<View style={styles.payment}>
						<Naira />
						<Text style={styles.PaymentText}>Price</Text>
						<Text style={styles.price}>₦ {Price}</Text>
					</View>

					{/* Promo link — coming soon, shown dimmed */}
					<View style={[styles.promo, styles.promoDisabled]}>
						<Text style={[styles.promoText, styles.promoTextDisabled]}>Promo codes — coming soon</Text>
					</View>

					{/* Buttons */}
					<View style={styles.button}>
						{activeRide ? (
							<View
								style={{
									alignItems: "center",
									flexDirection: "row",
									justifyContent: "space-between",
									gap: 10,
								}}
							>
								<DangerButton
									title={cancelling ? "Cancelling..." : "Cancel Ride"}
									onPress={handleCancelRide}
									disabled={cancelling}
								/>
								<ActiveButton
									title={rideStatus === 'accepted' ? "Ride accepted" : "Waiting for driver..."}
									disabled={true}
								/>
							</View>
						) : (
							<Payment
								amount={Price}
								email={email}
								phoneNumber={phone}
								name={`${firstName} ${lastName}`}
								BookRide={BookRide}
								loading={loading}
							/>
						)}
					</View>
				</View>
			</BottomSheet>

			{/* Booking-in-progress overlay — shown while Firestore write is pending
			    after Flutterwave payment completes. Prevents a blank 1-3 second gap. */}
			<Modal visible={loading} transparent animationType="fade">
				<View style={styles.loadingOverlay}>
					<View style={styles.loadingCard}>
						<ActivityIndicator size="large" color={colors.primaryBlue} />
						<Text style={styles.loadingText}>Booking your ride...</Text>
					</View>
				</View>
			</Modal>

			{showRatingModal && (
				<RatingModal
					visible={showRatingModal}
					onClose={() => {
						setShowRatingModal(false);
						setHomePage(); // Navigate back to home after rating
					}}
					rideId={rideId}
					driverId={activeRide?.driverId || null}
					driverName={acceptedDriverName || rider || "Driver"}
				/>
			)}
		</>
	);
};

export default ConfirmRide;

const styles = StyleSheet.create({
	bottomCont: {
		flex: 1,
		paddingBottom: sp(16),
	},
	callDriver: {
		backgroundColor: colors.lightGrey,
		paddingVertical: sp(10),
		justifyContent: "space-between",
		width: "100%",
		borderTopLeftRadius: br(30),
		borderTopRightRadius: br(30),
		paddingHorizontal: sp(16),
		flexDirection: "row",
	},
	button: {
		marginTop: "auto",
		paddingHorizontal: sp(16),
		gap: sp(10),
	},
	driverDetails: {
		marginHorizontal: sp(16),
		justifyContent: "center",
		flex: 1,
	},
	driverName: {
		fontFamily: "Albert-SemiBold",
		fontSize: fs(16),
	},
	info: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: sp(8),
		gap: sp(12),
	},
	price: {
		fontSize: fs(16),
		fontFamily: "Albert-SemiBold",
	},
	phoneCont: {
		justifyContent: "center",
		alignItems: "center",
		width: ms(50),
		height: ms(50),
		borderRadius: br(25),
		backgroundColor: "white",
	},
	locationCont: {
		alignItems: "center",
		flexDirection: "row",
		paddingHorizontal: sp(16),
		borderBottomWidth: 0.6,
		borderColor: colors.lightGrey3,
	},
	places: {
		justifyContent: "center",
		marginLeft: sp(16),
		flex: 1,
	},
	location: {
		width: "100%",
		paddingVertical: sp(10),
		backgroundColor: "white",
		borderBottomWidth: 0.6,
		borderColor: colors.lightGrey3,
	},
	locationText: {
		fontFamily: "Albert-Regular",
		fontSize: fs(16),
	},
	payment: {
		justifyContent: "space-between",
		width: "100%",
		borderTopLeftRadius: br(30),
		borderTopRightRadius: br(30),
		paddingHorizontal: sp(16),
		flexDirection: "row",
		alignItems: "center",
	},
	PaymentText: {
		fontFamily: "Albert-Regular",
		fontSize: fs(16),
		marginLeft: sp(10),
		marginRight: "auto",
	},
	promo: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: sp(16),
		width: "100%",
		justifyContent: "flex-end",
		gap: sp(5),
		marginTop: sp(16),
	},
	promoText: {
		fontFamily: "Albert-SemiBold",
		fontSize: fs(16),
		color: colors.primaryBlue,
	},
	promoDisabled: {
		opacity: 0.4,
	},
	promoTextDisabled: {
		color: colors.lightGrey3,
		fontFamily: "Albert-Regular",
		fontSize: fs(13),
	},
	loadingOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.45)",
		justifyContent: "center",
		alignItems: "center",
	},
	loadingCard: {
		backgroundColor: "white",
		borderRadius: br(16),
		paddingVertical: sp(32),
		paddingHorizontal: sp(40),
		alignItems: "center",
		gap: sp(16),
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 8,
	},
	loadingText: {
		fontSize: fs(16),
		fontFamily: "Albert-SemiBold",
		color: "#333",
	},
});

