import { StyleSheet, Text, TouchableOpacity, View, Alert, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import RatingModal, { PENDING_RATING_KEY } from "./modals/RatingModal";
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
import { createRide, listenToRide, cancelRideWithRefund, getRide } from "../helpers/firebaseRides";
import { calculateDistance, calculateFare } from "../helpers/rideCalculations";
import { FIREBASE_DB, FIREBASE_AUTH } from "../firebaseConfig";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import useAuthStore from "../constants/Store";
import { notifyDriversAboutNewRide, notifyDriverRideCancelled } from "../helpers/notificationHelpers";
import { payWithWallet } from "../helpers/walletHelpers";

const ConfirmRide = () => {
	const [selectRider, setSelectRider] = useState(false);
	const [loading, setLoading] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [rideId, setRideId] = useState(null);
	const [acceptedDriverName, setAcceptedDriverName] = useState("");
	const [showRatingModal, setShowRatingModal] = useState(false);
	const [walletBalance, setWalletBalance] = useState(null); // null = not yet loaded
	const [paymentMethod, setPaymentMethod] = useState('flutterwave'); // 'flutterwave' | 'wallet'
	const bookingInFlight = useRef(false);
	const navigation = useNavigation();
	const activeRide = useActiveRideStore((state) => state.activeRide);
	const rideStatus = useActiveRideStore((state) => state.rideStatus);
	const setHomePage = useBottomTabStore((state) => state.setHomePage);
	const clearAuth = useAuthStore((state) => state.clearAuth);
	const clearUser = useUserDetails((state) => state.clearUser);

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

	// Real-time wallet balance — updates the moment a top-up webhook fires
	useEffect(() => {
		if (!UserId) return;
		const unsub = onSnapshot(
			doc(FIREBASE_DB, 'users', UserId),
			(snap) => { if (snap.exists()) setWalletBalance(snap.data().walletBalance ?? 0); },
			() => {}
		);
		return () => unsub();
	}, [UserId]);

	// Pay for the ride by deducting the wallet balance server-side
	const handleWalletPay = async () => {
		if (!UserId || bookingInFlight.current) return;
		bookingInFlight.current = true;
		setLoading(true);
		AsyncStorage.removeItem(PENDING_RATING_KEY).catch(() => {});
		try {
			const result = await payWithWallet({
				customerName: `${firstName || ''} ${lastName || ''}`.trim() || 'Customer',
				customerPhone: phone || '',
				pickupLocation: location,
				pickupCoords: pickupLocation,
				destination,
				destinationCoords,
				numberOfPassengers: numberOfPassenger,
				amount: Price,
			});
			setRideId(result.rideId);
			useActiveRideStore.getState().setActiveRide({
				rideId: result.rideId,
				status: 'pending',
				driverName: null,
				driverId: null,
				driverPhone: null,
				vehicleId: null,
				hasArrived: false,
			});
			Toast.show({ type: 'tomatoToast', text1: 'Ride Booked!', text2: 'Searching for a driver near you...', position: 'top', visibilityTime: 3000 });
			setHomePage();
			// Notify online drivers — fire-and-forget, same as the Flutterwave path
			notifyDriversAboutNewRide(
				result.rideId,
				`${firstName || ''} ${lastName || ''}`.trim() || 'Customer',
				location,
				destination
			).catch(() => {});
		} catch (error) {
			const data = error.response?.data;
			if (data?.error === 'insufficient_balance') {
				Alert.alert('Insufficient Balance', `You need ₦${data.shortfall?.toLocaleString('en-NG') ?? ''} more. Top up your wallet and try again.`);
			} else {
				Alert.alert('Payment Failed', 'Could not process wallet payment. Please try again.');
			}
		} finally {
			bookingInFlight.current = false;
			setLoading(false);
		}
	};

	// ✅ Create a new ride using Firebase helper
	const BookRide = async (transactionId = null) => {
		setLoading(true);
		const currentUser = FIREBASE_AUTH.currentUser;

		// Validation: Check if user is logged in
		if (!UserId) {
			setLoading(false);
			Toast.show({
				type: 'tomatoToast',
				text1: 'Session Expired',
				text2: 'Please log in again to book a ride.',
				position: 'top',
			});
			setTimeout(async () => {
				try {
					await signOut(FIREBASE_AUTH);
					clearAuth();
					clearUser();
				} catch (error) {
					console.error("❌ Logout error:", error);
				}
			}, 1000);
			return;
		}

		// Validation: Check if Firebase Auth user matches store user
		if (!currentUser || currentUser.uid !== UserId) {
			setLoading(false);
			Toast.show({
				type: 'tomatoToast',
				text1: 'Authentication Error',
				text2: 'Your session is out of sync. Please log in again.',
				position: 'top',
			});
			setTimeout(async () => {
				try {
					await signOut(FIREBASE_AUTH);
					clearAuth();
					clearUser();
				} catch (error) {
					console.error("❌ Logout error:", error);
				}
			}, 1000);
			return;
		}

		// Validation before booking
		if (!pickupLocation || !destinationCoords) {
			setLoading(false);
			Toast.show({
				type: 'tomatoToast',
				text1: 'Missing Info',
				text2: "Pickup or destination not found. Please try again.",
				position: 'top',
			});
			return;
		}

		if (!numberOfPassenger) {
			setLoading(false);
			Toast.show({
				type: 'tomatoToast',
				text1: 'Missing Info',
				text2: "Please select number of passengers.",
				position: 'top',
			});
			return;
		}

		// Validation: Check if user profile data is loaded
		if (!email || !firstName) {
			console.log("⚠️ Warning: User profile data incomplete");
			setLoading(false);
			// Use Toast for warning too
			Toast.show({
				type: 'tomatoToast',
				text1: 'Profile Incomplete',
				text2: "Some profile data is missing, but we will try to continue.",
				position: 'top',
			});
			await continueBooking(transactionId);
			return;
		}

		await continueBooking(transactionId);
	};

	const continueBooking = async (transactionId = null) => {
		if (bookingInFlight.current) return;
		bookingInFlight.current = true;
		setLoading(true);
		// Clear any deferred rating reminder so it doesn't pop up mid-new-ride
		AsyncStorage.removeItem(PENDING_RATING_KEY).catch(() => {});
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
			// Small delay before major UI change to ensure previous transitions/modals are clean
			setTimeout(() => {
				setHomePage();
			}, 500);
		} catch (error) {
			console.error("❌ Error creating ride:", error);
			if (error.code === "permission-denied") {
				Toast.show({
					type: 'tomatoToast',
					text1: 'Database Error',
					text2: "Permission denied. Please contact support.",
					position: 'top',
					visibilityTime: 5000,
				});
			} else if (
				error.name === "AbortError" ||
				error.message?.toLowerCase().includes("network") ||
				error.message?.toLowerCase().includes("internet") ||
				error.code === "unavailable"
			) {
				Toast.show({
					type: 'tomatoToast',
					text1: 'Connection Error',
					text2: "Please check your internet connection.",
					position: 'top',
				});
			} else {
				Toast.show({
					type: 'tomatoToast',
					text1: 'Booking Failed',
					text2: "Failed to create ride. Please try again.",
					position: 'top',
				});
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
			Alert.alert("Error", "No active ride to cancel");
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
							const result = await cancelRideWithRefund(cancelRideId, 'customer', 'Customer cancelled ride');
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

							if (result.refundStatus === "completed") {
								Toast.show({
									type: "tomatoToast",
									text1: "Ride Cancelled & Refunded",
									text2: `₦${result.refundAmount} refund initiated — allow 3–5 business days`,
									position: "top",
									visibilityTime: 5000,
								});
							} else if (result.walletRefundStatus === "completed") {
								Toast.show({
									type: "tomatoToast",
									text1: "Ride Cancelled & Refunded",
									text2: `₦${result.refundAmount} returned to your wallet`,
									position: "top",
									visibilityTime: 5000,
								});
							} else if (
								result.refundStatus === "failed" ||
								result.refundStatus === "needs_review" ||
								result.walletRefundStatus === "failed"
							) {
								Toast.show({
									type: "tomatoToast",
									text1: "Ride Cancelled — Refund Issue",
									text2: "We could not process your refund automatically. Contact support for assistance.",
									position: "top",
									visibilityTime: 7000,
								});
							} else {
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
							<View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
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
							<>
								{/* Payment method selector */}
								<View style={styles.payMethodRow}>
									<TouchableOpacity
										onPress={() => setPaymentMethod('wallet')}
										style={[styles.payMethodTab, paymentMethod === 'wallet' && styles.payMethodTabActive]}
									>
										<Ionicons name="wallet-outline" size={15} color={paymentMethod === 'wallet' ? 'white' : colors.lightGrey3} />
										<Text style={[styles.payMethodText, paymentMethod === 'wallet' && styles.payMethodTextActive]}>
											Wallet
										</Text>
										{walletBalance !== null && (
											<Text style={[styles.payMethodBalance, paymentMethod === 'wallet' && styles.payMethodBalanceActive]}>
												₦{walletBalance.toLocaleString('en-NG')}
											</Text>
										)}
									</TouchableOpacity>
									<TouchableOpacity
										onPress={() => setPaymentMethod('flutterwave')}
										style={[styles.payMethodTab, paymentMethod === 'flutterwave' && styles.payMethodTabActive]}
									>
										<Ionicons name="card-outline" size={15} color={paymentMethod === 'flutterwave' ? 'white' : colors.lightGrey3} />
										<Text style={[styles.payMethodText, paymentMethod === 'flutterwave' && styles.payMethodTextActive]}>
											Card / Transfer
										</Text>
									</TouchableOpacity>
								</View>

								{paymentMethod === 'wallet' ? (
									walletBalance !== null && walletBalance < Price ? (
										<View style={styles.insufficientBox}>
											<Text style={styles.insufficientText}>
												Insufficient balance — you need ₦{(Price - walletBalance).toLocaleString('en-NG')} more
											</Text>
											<TouchableOpacity onPress={() => navigation.navigate('Wallet')}>
												<Text style={styles.topUpLink}>Top up wallet →</Text>
											</TouchableOpacity>
										</View>
									) : (
										<ActiveButton
											title={`Pay ₦${Price?.toLocaleString('en-NG')} from wallet`}
											onPress={handleWalletPay}
											loading={loading}
										/>
									)
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
							</>
						)}
					</View>
				</View>
			</BottomSheet>

			{/* Booking-in-progress overlay — plain View instead of Modal to avoid
			    _presentViewController crash on iOS when Flutterwave modal is mid-dismiss */}
			{loading && (
				<View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]}>
					<View style={styles.loadingCard}>
						<ActivityIndicator size="large" color={colors.primaryBlue} />
						<Text style={styles.loadingText}>Booking your ride...</Text>
					</View>
				</View>
			)}

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
	payMethodRow: {
		flexDirection: "row",
		gap: sp(8),
		marginBottom: sp(10),
	},
	payMethodTab: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: sp(6),
		paddingVertical: sp(10),
		borderRadius: br(10),
		backgroundColor: colors.lightGrey2,
	},
	payMethodTabActive: {
		backgroundColor: colors.primaryBlue,
	},
	payMethodText: {
		fontSize: fs(13),
		fontFamily: "Albert-SemiBold",
		color: colors.lightGrey3,
	},
	payMethodTextActive: {
		color: "white",
	},
	payMethodBalance: {
		fontSize: fs(11),
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
	},
	payMethodBalanceActive: {
		color: "rgba(255,255,255,0.8)",
	},
	insufficientBox: {
		backgroundColor: "#FFF3E0",
		borderRadius: br(10),
		padding: sp(14),
		alignItems: "center",
		gap: sp(6),
	},
	insufficientText: {
		fontSize: fs(13),
		fontFamily: "Albert-Regular",
		color: "#E65100",
		textAlign: "center",
	},
	topUpLink: {
		fontSize: fs(13),
		fontFamily: "Albert-SemiBold",
		color: colors.primaryBlue,
	},
});

