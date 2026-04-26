import React, { useState } from "react";
import {
	Alert,
	Modal,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const PENDING_RATING_KEY = "pending_customer_rating";
import { AntDesign } from "@expo/vector-icons";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { sp, fs, br, wp, ms } from "../../constants/responsive";
import { FIREBASE_DB } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc, arrayUnion, increment } from "firebase/firestore";

const { width } = Dimensions.get("screen");

const RatingModal = ({ visible, onClose, rideId, driverId, driverName, pickupLocation, destination, amount, completedAt, isReminder = false }) => {
	const [rating, setRating] = useState(0);
	const [feedback, setFeedback] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmitRating = async () => {
		if (rating === 0) {
			alert("Please select a rating");
			return;
		}

		setLoading(true);
		try {
			// Guard against duplicate submissions
			const rideSnap = await getDoc(doc(FIREBASE_DB, "rides", rideId));
			if (rideSnap.exists() && rideSnap.data()?.customerRating) {
				alert("You've already rated this ride.");
				onClose();
				return;
			}
			// Update driver's rating
			const driverRef = doc(FIREBASE_DB, "drivers", driverId);
			await updateDoc(driverRef, {
				ratings: arrayUnion({
					rideId,
					rating,
					feedback: feedback.trim(),
					createdAt: new Date(),
				}),
				totalRatings: increment(1),
				ratingSum: increment(rating),
			});

			// Update ride with rating — use setDoc/merge so the write succeeds
			// even if the ride document was archived after completion.
			const rideRef = doc(FIREBASE_DB, "rides", rideId);
			await setDoc(rideRef, {
				customerRating: rating,
				customerFeedback: feedback.trim(),
				ratedAt: new Date(),
			}, { merge: true });

			console.log("✅ Rating submitted successfully");
			// Clear any pending reminder now that rating is submitted
			await AsyncStorage.removeItem(PENDING_RATING_KEY).catch(() => {});
			alert("Thank you for your feedback!");

			// Reset and close
			setRating(0);
			setFeedback("");
			onClose();
		} catch (error) {
			console.error("❌ Error submitting rating:", error);
			alert("Unable to submit rating. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleRateLater = async () => {
		if (isReminder) {
			// Second dismissal — treat as a permanent skip
			await AsyncStorage.removeItem(PENDING_RATING_KEY).catch(() => {});
			setRating(0);
			setFeedback("");
			onClose();
			return;
		}

		Alert.alert(
			"Rate Later?",
			"Your rating helps drivers improve. We'll remind you the next time you open the app.",
			[
				{ text: "Rate Now", style: "cancel" },
				{
					text: "Remind Me Later",
					onPress: async () => {
						// Persist the ride details so we can re-surface the modal on next open
						const pendingRating = {
							rideId,
							driverId,
							driverName,
							pickupLocation,
							destination,
							amount,
						};
						await AsyncStorage.setItem(
							PENDING_RATING_KEY,
							JSON.stringify(pendingRating)
						).catch(() => {});
						setRating(0);
						setFeedback("");
						onClose();
					},
				},
			]
		);
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleRateLater}
		>
			<View style={styles.overlay}>
				<View style={styles.container}>
					<Text style={styles.title}>Rate Your Ride</Text>
					<Text style={styles.subtitle}>
						How was your experience with {driverName}?
					</Text>

					{/* Ride summary */}
					{(pickupLocation || destination || amount) && (
						<View style={styles.rideSummary}>
							{pickupLocation && destination && (
								<Text style={styles.rideSummaryRoute} numberOfLines={2}>
									{pickupLocation} → {destination}
								</Text>
							)}
							<View style={styles.rideSummaryRow}>
								{amount ? <Text style={styles.rideSummaryAmount}>₦{amount}</Text> : null}
								{completedAt?.toDate ? (
									<Text style={styles.rideSummaryTime}>
										{completedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
									</Text>
								) : null}
							</View>
						</View>
					)}

					{/* Star Rating */}
					<View style={styles.starsContainer}>
						{[1, 2, 3, 4, 5].map((star) => (
							<TouchableOpacity
								key={star}
								onPress={() => setRating(star)}
								activeOpacity={0.7}
							>
								<AntDesign
									name={star <= rating ? "star" : "staro"}
									size={ms(40)}
									color={star <= rating ? "#FFD700" : colors.lightGrey3}
									style={styles.star}
								/>
							</TouchableOpacity>
						))}
					</View>

					{/* Rating Text */}
					{rating > 0 && (
						<Text style={styles.ratingText}>
							{rating === 1 && "Poor"}
							{rating === 2 && "Fair"}
							{rating === 3 && "Good"}
							{rating === 4 && "Very Good"}
							{rating === 5 && "Excellent"}
						</Text>
					)}

					{/* Feedback Input */}
					<TextInput
						style={styles.feedbackInput}
						placeholder="Share your experience (optional)"
						placeholderTextColor={colors.lightGrey3}
						value={feedback}
						onChangeText={setFeedback}
						multiline
						numberOfLines={4}
						textAlignVertical="top"
					/>

					{/* Buttons */}
					<View style={styles.buttonsContainer}>
						<TouchableOpacity
							style={styles.skipButton}
							onPress={handleRateLater}
							disabled={loading}
						>
							<Text style={styles.skipText}>
								{isReminder ? "Skip" : "Later"}
							</Text>
						</TouchableOpacity>
						<View style={styles.submitButton}>
							<ActiveButton
								title={loading ? "Submitting..." : "Submit"}
								onPress={handleSubmitRating}
								loading={loading}
								disabled={loading || rating === 0}
							/>
						</View>
					</View>
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	container: {
		backgroundColor: "white",
		width: wp(327),
		maxWidth: width - sp(48),
		borderRadius: br(20),
		padding: sp(24),
		alignItems: "center",
	},
	title: {
		fontSize: fs(24),
		fontFamily: "Albert-SemiBold",
		color: "black",
		marginBottom: sp(8),
		textAlign: "center",
	},
	subtitle: {
		fontSize: fs(16),
		fontFamily: "Albert-Regular",
		color: colors.textGrey,
		textAlign: "center",
		marginBottom: sp(24),
		paddingHorizontal: sp(8),
	},
	rideSummary: {
		width: '100%',
		backgroundColor: '#f5f5f5',
		borderRadius: br(10),
		padding: sp(12),
		marginBottom: sp(20),
	},
	rideSummaryRoute: {
		fontSize: fs(13),
		color: '#444',
		fontFamily: 'Albert-Regular',
		marginBottom: sp(6),
		textAlign: 'center',
	},
	rideSummaryRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: sp(16),
	},
	rideSummaryAmount: {
		fontSize: fs(14),
		fontFamily: 'Albert-SemiBold',
		color: colors.primaryBlue,
	},
	rideSummaryTime: {
		fontSize: fs(13),
		color: colors.lightGrey3,
		fontFamily: 'Albert-Regular',
	},
	starsContainer: {
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: sp(12),
		flexWrap: "wrap",
	},
	star: {
		marginHorizontal: sp(4),
	},
	ratingText: {
		fontSize: fs(18),
		fontFamily: "Albert-SemiBold",
		color: colors.primaryBlue,
		marginBottom: sp(20),
	},
	feedbackInput: {
		width: "100%",
		borderWidth: 1,
		borderColor: colors.lightGrey2,
		borderRadius: br(12),
		padding: sp(12),
		fontSize: fs(14),
		fontFamily: "Albert-Regular",
		minHeight: sp(100),
		maxHeight: sp(150),
		marginBottom: sp(20),
	},
	buttonsContainer: {
		flexDirection: "row",
		width: "100%",
		gap: sp(12),
	},
	skipButton: {
		flex: 1,
		paddingVertical: sp(14),
		borderRadius: br(12),
		borderWidth: 1,
		borderColor: colors.lightGrey2,
		alignItems: "center",
		justifyContent: "center",
		minHeight: sp(48),
	},
	skipText: {
		fontSize: fs(16),
		fontFamily: "Albert-SemiBold",
		color: colors.textGrey,
	},
	submitButton: {
		flex: 2,
	},
});

export default RatingModal;
