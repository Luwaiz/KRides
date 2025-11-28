import { StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, Platform } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import React, { useEffect, useState } from "react";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import { Entypo } from "@expo/vector-icons";
import Avatar from "../assets/svg/Frame 77avatar.svg";
import Phone from "../assets/svg/Call.svg";
import Star from "../assets/svg/Rating.svg";
import Direction from "../assets/svg/Frame 34direction.svg";
import Naira from "../assets/svg/Naira.svg";
import RideConfirm from "./modals/RideConfirm";
import RatingModal from "./modals/RatingModal";
import { sp, fs, br, ms } from "../constants/responsive";
import Toast from "react-native-toast-message";
import {
	useRideStore,
	useUserDetails,
	useRideDetailsStore,
	useBottomTabStore,
} from "../constants/Store";
import InActiveButton from "./buttons/InActiveButton";
import DangerButton from "./buttons/DangerButton";
import Payment from "../screens/AppScreens/Payment";
import { createRide, listenToRide, cancelRide, cancelRideWithRefund } from "../helpers/firebaseRides";
import { FIREBASE_DB, FIREBASE_AUTH } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import useAuthStore from "../constants/Store";
import { calculateFare } from "../helpers/rideCalculations";

const ConfirmRide = () => {
	const navigation = useNavigation();
	const [selectRider, setSelectRider] = useState(false);
	const [loading, setLoading] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [pending, setPending] = useState(false);
	const [rideId, setRideId] = useState(null);
	const [rideStatus, setRideStatus] = useState("pending");
	const [acceptedDriverName, setAcceptedDriverName] = useState("");
	const [acceptedDriverId, setAcceptedDriverId] = useState("");
	const [driverSubaccountId, setDriverSubaccountId] = useState(null);
	const [showRatingModal, setShowRatingModal] = useState(false);
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

	console.log("👤 Customer details from store:");
	console.log("   - First Name:", firstName || "MISSING");
	console.log("   - Last Name:", lastName || "MISSING");
	console.log("   - Email:", email || "MISSING");
	console.log("   - Phone:", phone || "MISSING");
	console.log("   - User ID:", UserId || "MISSING");

	const Price = calculateFare(null,numberOfPassenger);

	const ToPromo = () => {
		navigation.navigate("Promo");
	};

	// ✅ Create a new ride using Firebase helper
	const BookRide = async (transactionId = null, paymentData = null) => {
		console.log("🚀 BookRide function called!");
		console.log("📍 Pickup:", location, pickupLocation);
		console.log("📍 Destination:", destination, destinationCoords);
		console.log("👥 Passengers:", numberOfPassenger);
		console.log("💰 Price:", Price);
		console.log("💳 Transaction ID:", transactionId);

		// Check Firebase Auth state
		const currentUser = FIREBASE_AUTH.currentUser;
		if (!currentUser) {
			console.error("❌ No authenticated user found!");
			Alert.alert("Error", "You must be logged in to book a ride.");
			return;
		}

		setLoading(true);
		setPending(true);

		try {
			const newRideId = await createRide({
				customerId: currentUser.uid,
				customerName: `${firstName} ${lastName}`,
				customerPhone: phone,
				pickupLocation,
				destination: destinationCoords,
				pickupAddress: location,
				destinationAddress: destination,
				amount: Price,
				numberOfPassengers: numberOfPassenger,
				paymentMethod: "flutterwave",
				transactionId: transactionId, // Save transaction ID for refunds
				paymentData: paymentData ? {
					tx_ref: paymentData.tx_ref,
					flw_ref: paymentData.flw_ref,
					status: paymentData.status,
				} : null,
			});

			if (newRideId) {
				console.log("✅ Ride created successfully with ID:", newRideId);
				if (transactionId) {
					console.log("✅ Transaction ID saved:", transactionId);
				}
				setRideId(newRideId);
				setRideStatus("pending");
			} else {
				throw new Error("Failed to create ride - no ID returned");
			}
		} catch (error) {
			console.error("❌ Error creating ride:", error);
			setPending(false);

			// Show user-friendly error message
			let errorMessage = "Unable to book ride. Please try again.";
			if (error.message.includes("permission-denied")) {
				errorMessage = "Permission denied. Please check your account status.";
			} else if (error.message.includes("unavailable")) {
				errorMessage = "Network unavailable. Please check your connection.";
			}

			if (Platform.OS === 'android') {
				Toast.show({
					type: 'error',
					text1: 'Booking Failed',
					text2: errorMessage
				});
			} else {
				alert(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	// 👂 Listen for changes on the ride document (real-time updates)
	useEffect(() => {
		if (!rideId) return;
		console.log("📡 Listening for ride updates for ID:", rideId);

		const unsubscribe = listenToRide(rideId, (rideData) => {
			if (rideData) {
				console.log("🔥 Ride update received:");
				console.log("   - Status:", rideData.status);
				console.log("   - Driver:", rideData.driverName);
				setRideStatus(rideData.status);

				// If driver accepts ride
				if (rideData.status === "accepted") {
					console.log("✅ Driver accepted the ride!");
					console.log("   - Updating driver name to:", rideData.driverName);
					console.log("   - Driver ID:", rideData.driverId);

					// Update rider name and ID in local state
					if (rideData.driverName) {
						setAcceptedDriverName(rideData.driverName);
						setRider(rideData.driverName);
						console.log("   - Driver name saved:", rideData.driverName);

						// Show toast notification
						Toast.show({
							type: "tomatoToast",
							text1: "Driver Accepted!",
							text2: `${rideData.driverName} is on the way`,
							position: "top",
							visibilityTime: 4000,
						});
					} else {
						console.log("   ⚠️ Warning: driverName is empty!");
					}

					if (rideData.driverId) {
						setAcceptedDriverId(rideData.driverId);
					}

					if (rideData.driverSubaccountId) {
						console.log("   - Driver Subaccount ID:", rideData.driverSubaccountId);
						setDriverSubaccountId(rideData.driverSubaccountId);
					}

					setPending(false);
					setSelectRider(true);
				} // If ride is completed - show rating modal
				if (rideData.status === "completed" && !rideData.customerRating) {
					console.log("✅ Ride completed - showing rating modal");
					setPending(false);
					setSelectRider(false);
					setShowRatingModal(true);
				}

				// If ride is cancelled
				if (rideData.status === "cancelled") {
					console.log("❌ Ride was cancelled");
					setPending(false);
					setSelectRider(false);

					Toast.show({
						type: "tomatoToast",
						text1: "Ride Cancelled",
						text2: "Your ride has been cancelled",
						position: "top",
						visibilityTime: 3000,
					});
				}
			} else {
				console.log("⚠️ Ride data is null");
			}
		});

		return () => {
			console.log("🔌 Unsubscribing from ride updates");
			unsubscribe();
		};
	}, [rideId]);

	// ❌ Cancel ride with confirmation dialog and automatic refund
	const handleCancelRide = () => {
		if (!rideId) {
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
							// Use cancelRideWithRefund to automatically process refunds
							const result = await cancelRideWithRefund(
								rideId,
								'customer',
								'Customer cancelled the ride'
							);

							console.log("✅ Ride cancelled successfully");
							console.log("   Refund status:", result.refundStatus || "N/A");

							// Reset all states
							setPending(false);
							setSelectRider(false);
							setRideId(null);
							setRideStatus("pending");
							setAcceptedDriverName("");

							// Navigate back to home
							setHomePage();

							// Show appropriate message based on refund status
							if (result.refundStatus === "completed") {
								Toast.show({
									type: "tomatoToast",
									text1: "Ride Cancelled & Refunded",
									text2: `₦${result.refundAmount} will be refunded to your account`,
									position: "top",
									visibilityTime: 4000,
								});
							} else if (result.refundStatus === "failed") {
								Toast.show({
									type: "tomatoToast",
									text1: "Ride Cancelled",
									text2: "Refund failed. Please contact support for assistance.",
									position: "top",
									visibilityTime: 4000,
								});
							} else {
								// No refund needed (cash payment or no transaction)
								Toast.show({
									type: "tomatoToast",
									text1: "Ride Cancelled",
									text2: "Your ride has been cancelled successfully",
									position: "top",
									visibilityTime: 3000,
								});
							}
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
						<View style={styles.phoneCont}>
							<Phone width={25} height={25} />
						</View>
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

					{/* Promo link */}
					<TouchableOpacity
						onPress={ToPromo}
						activeOpacity={0.6}
						style={styles.promo}
					>
						<Text style={styles.promoText}>Enter promo code</Text>
						<Entypo
							name="chevron-small-right"
							size={24}
							color={colors.primaryBlue}
						/>
					</TouchableOpacity>

					{/* Buttons */}
					<View style={styles.button}>
						{pending ? (
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
								<ActiveButton title={"Ride Pending..."} disabled={true} />
							</View>
						) : (
							<Payment
								amount={Price}
								email={email}
								phoneNumber={phone}
								name={`${firstName} ${lastName}`}
								BookRide={BookRide}
								subaccountId={driverSubaccountId}
							/>
						)}
					</View>
				</View>
			</BottomSheet>

			{selectRider && (
				<RideConfirm
					modal={selectRider}
					setModal={setSelectRider}
					driverName={acceptedDriverName || rider || "Driver"}
				/>
			)}

			{showRatingModal && (
				<RatingModal
					visible={showRatingModal}
					onClose={() => {
						setShowRatingModal(false);
						setHomePage(); // Navigate back to home after rating
					}}
					rideId={rideId}
					driverId={acceptedDriverId}
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
});
