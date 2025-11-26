import { FlatList, StyleSheet, Text, View, Dimensions } from "react-native";
import React, { useEffect, useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/buttons/BackButton";
import HistoryCard from "../../components/HistoryCard";
import { useUserDetails, useDriverDetails } from "../../constants/Store";
import { ActivityIndicator } from "react-native-paper";
import { getCustomerHistory, getDriverHistory } from "../../helpers/firebaseRides";

const { width } = Dimensions.get("window");

const History = () => {
	const [loading, setLoading] = useState(false);
	const [history, setHistory] = useState([]);
	const UserId = useUserDetails((state) => state?.UserId);
	const driverUid = useDriverDetails((state) => state?.uid);

	const currentMonth = new Date();
	const currentMonthName = currentMonth.toLocaleString("default", {
		month: "long",
		year: "numeric",
	});

	const getHistory = async () => {
		// Determine if user is a driver by checking which ID is available
		const isDriver = !!driverUid && !UserId;
		const userId = isDriver ? driverUid : UserId;

		console.log("🔍 History - Is Driver:", isDriver);
		console.log("🔍 History - User ID:", userId || "MISSING");

		if (!userId) {
			console.log("⚠️ No user ID found, cannot fetch history");
			return;
		}

		setLoading(true);
		try {
			console.log(`📜 Fetching ${isDriver ? "driver" : "customer"} history for:`, userId);
			const rides = isDriver
				? await getDriverHistory(userId)
				: await getCustomerHistory(userId);
			console.log("✅ History fetched:", rides.length, "rides");
			console.log("📊 Ride details:", JSON.stringify(rides, null, 2));
			setHistory(rides);
		} catch (error) {
			console.error("❌ Error fetching history:", error);
			setHistory([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		getHistory();
	}, [UserId, driverUid]);

	return (
		<SafeAreaView style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Ride history</Text>} />
			{loading ? (
				<ActivityIndicator
					size={30}
					color={colors.primaryBlue}
					style={{ marginTop: 20 }}
				/>
			) : (
				<FlatList
					data={history}
					keyExtractor={(item, index) => item.rideId || index.toString()}
					renderItem={({ item, index }) => <HistoryCard history={item} />}
					ListHeaderComponent={
						<Text style={styles.monthDate}>{currentMonthName}</Text>
					}
					ListEmptyComponent={
						<Text style={styles.emptyText}>No ride history yet</Text>
					}
					contentContainerStyle={styles.contentContainer}
					style={{ width }}
				/>
			)}
		</SafeAreaView>
	);
};

export default History;

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.secondary2,
		flex: 1,
		alignItems: "center",
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	monthDate: {
		marginTop: 20,
		fontSize: 20,
		fontFamily: "Albert-SemiBold",
	},
	contentContainer: {
		paddingHorizontal: 16,
	},
	emptyText: {
		textAlign: "center",
		marginTop: 40,
		fontSize: 16,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
	},
});
