import {
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useState } from "react";
import { colors } from "../constants/styling";
import Direction from "../assets/svg/Frame 34direction.svg";
import AntDesign from "@expo/vector-icons/AntDesign";
import { format } from "date-fns";

const HistoryCard = ({ history }) => {
	const [selected, setSelected] = useState(null);

	if (!history) {
		return null;
	}

	// Get the timestamp (completedAt or cancelledAt or createdAt as fallback)
	const timestamp =
		history?.completedAt || history?.cancelledAt || history?.createdAt;

	let date;
	try {
		date = timestamp?.toDate ? timestamp.toDate() : new Date();
	} catch (error) {
		console.error("Error parsing date:", error);
		date = new Date();
	}

	// Format date and time
	let dateFormat = "N/A";
	let time = "N/A";

	try {
		dateFormat = format(date, "dd MMMM yyyy");
		time = format(date, "hh:mm a");
	} catch (error) {
		console.error("Error formatting date:", error);
	}

	// Determine if ride was completed or cancelled
	const isCompleted = history?.status === "completed";

	const onhold = (id) => {
		if (selected === id) {
			setSelected(null);
		} else {
			setSelected(id);
		}
	};
	return (
		<View style={styles.historyContainer}>
			{history !== undefined && (
				<Pressable onLongPress={() => onhold(history?.rideId)}>
					<View style={styles.dateContainer}>
						<Text style={styles.dayDate}>{dateFormat}</Text>
						<Text style={styles.time}>{time}</Text>
					</View>

					<View style={styles.locationCont}>
						<Direction width={40} height={80} />
						<View style={styles.places}>
							<View style={styles.location}>
								<Text style={styles.locationText}>
									{history?.pickupLocation || "Pickup location"}
								</Text>
							</View>
							<View style={styles.location}>
								<Text style={styles.locationText}>
									{history?.destination || "Destination"}
								</Text>
							</View>
						</View>
					</View>

					<View style={styles.dateContainer}>
						<Text style={styles.dayDate}>Driver</Text>
						<Text style={styles.time}>
							{history?.driverName || "No driver assigned"}
						</Text>
					</View>

					<View style={styles.dateContainer}>
						<Text style={styles.dayDate}>Passengers</Text>
						<Text style={styles.time}>{history?.numberOfPassengers || 1}</Text>
					</View>

					<View style={styles.status}>
						<Text style={styles.statusText}>₦ {history?.amount || 0}</Text>
						{isCompleted ? (
							<Text style={styles.complete}>Completed</Text>
						) : (
							<Text style={styles.cancelled}>Cancelled</Text>
						)}
					</View>
				</Pressable>
			)}
		</View>
	);
};

export default HistoryCard;

const styles = StyleSheet.create({
	dateContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginVertical: 5,
	},
	historyContainer: {
		backgroundColor: "white",
		alignSelf: "center",
		borderRadius: 16,
		padding: 16,
		marginVertical: 16,
		width: "100%",
		borderColor: colors.lightGrey2,
		borderWidth: 2,
	},
	dayDate: {
		fontSize: 18,
		fontFamily: "Albert-Regular",
	},
	locationCont: {
		alignItems: "center",
		flexDirection: "row",
		marginBottom: 10,
	},
	places: {
		justifyContent: "center",
		marginLeft: 10,
		marginTop: 10,
	},
	location: {
		width: "100%",
		paddingVertical: 10,
	},
	locationText: {
		fontFamily: "Albert-Regular",
		fontSize: 16,
	},
	status: {
		width: "100%",
		height: 38,
		backgroundColor: colors.lightGrey2,
		borderRadius: 8,
		marginTop: "auto",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 8,
	},
	statusText: {
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
	},
	complete: {
		color: colors.primaryBlue,
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
	},
	cancelled: {
		color: colors.lightGrey3,
		fontSize: 16,
		fontFamily: "Albert-Regular",
	},
	time: {
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
		marginTop: 4,
		marginBottom: 4,
	},
});
