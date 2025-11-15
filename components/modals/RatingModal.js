import React, { useState } from "react";
import {
	Modal,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { sp, fs, br, wp, ms } from "../../constants/responsive";
import { FIREBASE_DB } from "../../firebaseConfig";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";

const { width } = Dimensions.get("screen");

const RatingModal = ({ visible, onClose, rideId, driverId, driverName }) => {
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

			// Update ride with rating
			const rideRef = doc(FIREBASE_DB, "rides", rideId);
			await updateDoc(rideRef, {
				customerRating: rating,
				customerFeedback: feedback.trim(),
				ratedAt: new Date(),
			});

			console.log("✅ Rating submitted successfully");
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

	const handleClose = () => {
		setRating(0);
		setFeedback("");
		onClose();
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleClose}
		>
			<View style={styles.overlay}>
				<View style={styles.container}>
					<Text style={styles.title}>Rate Your Ride</Text>
					<Text style={styles.subtitle}>
						How was your experience with {driverName}?
					</Text>

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
							onPress={handleClose}
							disabled={loading}
						>
							<Text style={styles.skipText}>Skip</Text>
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
