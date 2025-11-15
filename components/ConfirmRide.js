import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
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
import { createRide, listenToRide, cancelRide } from "../helpers/firebaseRides";
import { FIREBASE_DB, FIREBASE_AUTH } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import useAuthStore from "../constants/Store";

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

	const Price = numberOfPassenger * 200;

	const ToPromo = () => {
		navigation.navigate("Promo");
	};

	// ✅ Create a new ride using Firebase helper
	const BookRide = async () => {
		console.log("🚀 BookRide function called!");
		console.log("📍 Pickup:", location, pickupLocation);
		console.log("📍 Destination:", destination, destinationCoords);
		console.log("👥 Passengers:", numberOfPassenger);
		console.log("💰 Price:", Price);

		// Check Firebase Auth state
		const currentUser = FIREBASE_AUTH.currentUser;
		console.log("🔐 Firebase Auth State:");
		console.log("   - User exists:", !!currentUser);
		console.log("   - User UID:", currentUser?.uid);
		console.log("   - Store UserId:", UserId);
		console.log("   - Match:", currentUser?.uid === UserId);

		// Validation: Check if user is logged in
		if (!UserId) {
			console.log("❌ Validation failed: User not logged in");
			Alert.alert(
				"Session Expired",
				"Please log in to book a ride.",
				[
					{
						text: "OK",
						onPress: async () => {
							try {
								console.log("🔓 Logging out user...");
								await signOut(FIREBASE_AUTH);
								clearAuth();
								clearUser();
								console.log("✅ User logged out successfully");
								Toast.show({
									type: "tomatoToast",
									text1: "Logged Out",
									text2: "Please log in again",
									position: "top",
									visibilityTime: 2000,
								});
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
			console.log(
				"❌ Auth mismatch - Firebase UID:",
				currentUser?.uid,
				"Store UID:",
				UserId
			);
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
								Toast.show({
									type: "tomatoToast",
									text1: "Please Log In Again",
									text2: "Session was out of sync",
									position: "top",
									visibilityTime: 2000,
								});
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
			console.log("❌ Validation failed: Missing location information");
			alert(
				"Missing location information. Please go back and select pickup and destination again."
			);
			return;
		}

		if (!numberOfPassenger) {
			console.log("❌ Validation failed: No passengers selected");
			alert("Please select number of passengers.");
			return;
		}

		setLoading(true);
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
			};

			console.log(
				"📦 Creating ride in Firestore with data:",
				JSON.stringify(rideData, null, 2)
			);
			const newRideId = await createRide(rideData);
			console.log("✅ Ride created successfully! Ride ID:", newRideId);

			setRideId(newRideId);
			setPending(true);
			setLoading(false);
		} catch (error) {
			console.error("❌ Error creating ride:", error);
			let errorMessage = "Failed to create ride. Please try again.";

			if (error.code === "permission-denied") {
				errorMessage =
					"Permission denied. This is a Firebase security rule issue. Please check FIRESTORE_RULES_FIX.md for instructions.";
				Alert.alert(
					"Firebase Permission Error",
					"The Firestore security rules are blocking ride creation. This is a Firebase Console configuration issue, not an app issue.\n\nPlease:\n1. Open Firebase Console\n2. Go to Firestore → Rules\n3. Update and publish the security rules\n\nSee FIRESTORE_RULES_FIX.md for detailed instructions.",
					[{ text: "OK" }]
				);
			} else {
				alert(errorMessage);
			}
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

	// ❌ Cancel ride with confirmation dialog
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
							await cancelRide(rideId);
							console.log("✅ Ride cancelled successfully");

							// Reset all states
							setPending(false);
							setSelectRider(false);
							setRideId(null);
							setRideStatus("pending");
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
