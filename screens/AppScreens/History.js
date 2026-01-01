import { FlatList, StyleSheet, Text, View, Dimensions } from "react-native";
import React, { useEffect, useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/buttons/BackButton";
import HistoryCard from "../../components/HistoryCard";
import { useUserDetails, useDriverDetails } from "../../constants/Store";
import { ActivityIndicator } from "react-native-paper";
import { getCustomerHistoryPaginated, getDriverHistoryPaginated } from "../../helpers/firebaseRides";

const { width } = Dimensions.get("window");
const PAGE_SIZE = 20;

const History = () => {
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [history, setHistory] = useState([]);
	const [lastVisible, setLastVisible] = useState(null);
	const [hasMore, setHasMore] = useState(true);
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
			console.log(`📜 Fetching ${isDriver ? "driver" : "customer"} history (paginated) for:`, userId);
			const result = isDriver
				? await getDriverHistoryPaginated(userId, PAGE_SIZE)
				: await getCustomerHistoryPaginated(userId, PAGE_SIZE);

			console.log("✅ History fetched:", result.rides.length, "rides");
			setHistory(result.rides);
			setLastVisible(result.lastVisible);
			setHasMore(result.hasMore);
		} catch (error) {
			console.error("❌ Error fetching history:", error);
			setHistory([]);
			setHasMore(false);
		} finally {
			setLoading(false);
		}
	};

	const loadMoreHistory = async () => {
		if (loadingMore || !hasMore) return;

		const isDriver = !!driverUid && !UserId;
		const userId = isDriver ? driverUid : UserId;

		if (!userId || !lastVisible) return;

		setLoadingMore(true);
		try {
			console.log("📜 Loading more history...");
			const result = isDriver
				? await getDriverHistoryPaginated(userId, PAGE_SIZE, lastVisible)
				: await getCustomerHistoryPaginated(userId, PAGE_SIZE, lastVisible);

			console.log("✅ More history loaded:", result.rides.length, "rides");
			setHistory((prev) => [...prev, ...result.rides]);
			setLastVisible(result.lastVisible);
			setHasMore(result.hasMore);
		} catch (error) {
			console.error("❌ Error loading more history:", error);
		} finally {
			setLoadingMore(false);
		}
	};

	useEffect(() => {
		getHistory();
	}, [UserId, driverUid]);

	const renderFooter = () => {
		if (!loadingMore) return null;
		return (
			<View style={styles.footerLoader}>
				<ActivityIndicator size={24} color={colors.primaryBlue} />
				<Text style={styles.loadingText}>Loading more rides...</Text>
			</View>
		);
	};

	const renderEmpty = () => {
		if (loading) return null;
		return <Text style={styles.emptyText}>No ride history yet</Text>;
	};

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
					ListEmptyComponent={renderEmpty}
					ListFooterComponent={renderFooter}
					onEndReached={loadMoreHistory}
					onEndReachedThreshold={0.5}
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
	footerLoader: {
		paddingVertical: 20,
		alignItems: "center",
	},
	loadingText: {
		marginTop: 8,
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
	},
});
