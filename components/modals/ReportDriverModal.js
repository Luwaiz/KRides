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
import { AntDesign, Ionicons } from "@expo/vector-icons";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { sp, fs, br, wp } from "../../constants/responsive";
import { FIREBASE_AUTH } from "../../firebaseConfig";
import { NOTIFICATION_API_KEY } from "@env";

const { width } = Dimensions.get("screen");

const REPORT_REASONS = [
	"Driver didn't show up",
	"Dangerous driving",
	"Wrong vehicle",
	"Rude or threatening behaviour",
	"Charged wrong amount",
	"Other",
];

const SERVER_URL = "https://krides.onrender.com/api/reports";

const ReportDriverModal = ({ visible, onClose, history }) => {
	const [selectedReason, setSelectedReason] = useState(null);
	const [description, setDescription] = useState("");
	const [loading, setLoading] = useState(false);

	const handleClose = () => {
		if (loading) return;
		setSelectedReason(null);
		setDescription("");
		onClose();
	};

	const handleSubmit = async () => {
		if (!selectedReason) {
			Alert.alert("Select a reason", "Please choose a reason for your report.");
			return;
		}

		setLoading(true);
		try {
			const idToken = await FIREBASE_AUTH.currentUser?.getIdToken();
			if (!idToken) throw new Error("Not logged in");

			const response = await fetch(`${SERVER_URL}/driver`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": NOTIFICATION_API_KEY || "",
				},
				body: JSON.stringify({
					idToken,
					rideId: history.rideId,
					reason: selectedReason,
					description: description.trim(),
				}),
			});

			const result = await response.json();

			if (result.alreadyReported) {
				Alert.alert(
					"Already Reported",
					"You've already submitted a report for this ride.",
					[{ text: "OK", onPress: handleClose }]
				);
				return;
			}

			if (result.success) {
				Alert.alert(
					"Report Submitted",
					"Thank you. We've received your report and will review it within 24 hours.",
					[{ text: "OK", onPress: handleClose }]
				);
			} else {
				throw new Error(result.error || "Could not submit report");
			}
		} catch (error) {
			console.error("❌ Report submission error:", error);
			Alert.alert("Error", "Could not submit your report. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	if (!history) return null;

	const pickupName =
		typeof history.pickupLocation === "object"
			? history.pickupLocation?.name || history.pickupLocation?.address || "Pickup"
			: history.pickupLocation || "Pickup";

	const destName =
		typeof history.destination === "object"
			? history.destination?.name || history.destination?.address || "Destination"
			: history.destination || "Destination";

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
			<View style={styles.overlay}>
				<View style={styles.container}>
					{/* Header */}
					<View style={styles.header}>
						<Text style={styles.title}>Report Driver</Text>
						<TouchableOpacity onPress={handleClose} disabled={loading} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
							<AntDesign name="close" size={22} color={colors.lightGrey3} />
						</TouchableOpacity>
					</View>

					<Text style={styles.subtitle}>What went wrong with this ride?</Text>

					{/* Ride summary */}
					<View style={styles.rideSummary}>
						<Text style={styles.driverName}>{history.driverName || "Driver"}</Text>
						<Text style={styles.rideRoute} numberOfLines={2}>
							{pickupName} → {destName}
						</Text>
					</View>

					{/* Reason chips */}
					<View style={styles.reasons}>
						{REPORT_REASONS.map((reason) => (
							<TouchableOpacity
								key={reason}
								style={[
									styles.reasonChip,
									selectedReason === reason && styles.reasonChipSelected,
								]}
								onPress={() => setSelectedReason(reason)}
								activeOpacity={0.7}
								disabled={loading}
							>
								{selectedReason === reason && (
									<Ionicons name="checkmark-circle" size={14} color="white" style={{ marginRight: 4 }} />
								)}
								<Text
									style={[
										styles.reasonText,
										selectedReason === reason && styles.reasonTextSelected,
									]}
								>
									{reason}
								</Text>
							</TouchableOpacity>
						))}
					</View>

					{/* Optional description */}
					<TextInput
						style={styles.input}
						placeholder="Additional details (optional)"
						placeholderTextColor={colors.lightGrey3}
						value={description}
						onChangeText={setDescription}
						multiline
						numberOfLines={3}
						textAlignVertical="top"
						maxLength={300}
						editable={!loading}
					/>
					<Text style={styles.charCount}>{description.length}/300</Text>

					{/* Buttons */}
					<View style={styles.buttons}>
						<TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={loading}>
							<Text style={styles.cancelText}>Cancel</Text>
						</TouchableOpacity>
						<View style={styles.submitButton}>
							<ActiveButton
								title={loading ? "Submitting..." : "Submit Report"}
								onPress={handleSubmit}
								loading={loading}
								disabled={loading || !selectedReason}
							/>
						</View>
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default ReportDriverModal;

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	container: {
		backgroundColor: "white",
		width: wp(327),
		maxWidth: width - sp(48),
		borderRadius: br(20),
		padding: sp(24),
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: sp(8),
	},
	title: {
		fontSize: fs(20),
		fontFamily: "Albert-SemiBold",
		color: "black",
	},
	subtitle: {
		fontSize: fs(14),
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
		marginBottom: sp(16),
	},
	rideSummary: {
		backgroundColor: "#f5f5f5",
		borderRadius: br(10),
		padding: sp(12),
		marginBottom: sp(16),
	},
	driverName: {
		fontSize: fs(14),
		fontFamily: "Albert-SemiBold",
		color: "#333",
		marginBottom: sp(4),
	},
	rideRoute: {
		fontSize: fs(12),
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
	},
	reasons: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: sp(8),
		marginBottom: sp(16),
	},
	reasonChip: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: sp(12),
		paddingVertical: sp(8),
		borderRadius: br(20),
		borderWidth: 1.5,
		borderColor: colors.lightGrey2,
		backgroundColor: "white",
	},
	reasonChipSelected: {
		backgroundColor: colors.primaryBlue,
		borderColor: colors.primaryBlue,
	},
	reasonText: {
		fontSize: fs(12),
		fontFamily: "Albert-Regular",
		color: "#555",
	},
	reasonTextSelected: {
		color: "white",
		fontFamily: "Albert-SemiBold",
	},
	input: {
		borderWidth: 1,
		borderColor: colors.lightGrey2,
		borderRadius: br(12),
		padding: sp(12),
		fontSize: fs(13),
		fontFamily: "Albert-Regular",
		minHeight: sp(80),
		color: "#333",
	},
	charCount: {
		fontSize: fs(11),
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
		textAlign: "right",
		marginTop: sp(4),
		marginBottom: sp(16),
	},
	buttons: {
		flexDirection: "row",
		gap: sp(12),
	},
	cancelButton: {
		flex: 1,
		paddingVertical: sp(14),
		borderRadius: br(12),
		borderWidth: 1,
		borderColor: colors.lightGrey2,
		alignItems: "center",
		justifyContent: "center",
	},
	cancelText: {
		fontSize: fs(15),
		fontFamily: "Albert-SemiBold",
		color: colors.lightGrey3,
	},
	submitButton: {
		flex: 2,
	},
});
