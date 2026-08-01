import { FlatList, StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView } from "react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/buttons/BackButton";
import HistoryCard from "../../components/HistoryCard";
import { useUserDetails, useDriverDetails } from "../../constants/Store";
import { ActivityIndicator } from "react-native-paper";
import { getCustomerHistoryPaginated, getDriverHistoryPaginated } from "../../helpers/firebaseRides";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const History = () => {
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState(false);
	const [history, setHistory] = useState([]);
	const [lastVisible, setLastVisible] = useState(null);
	const [hasMore, setHasMore] = useState(false);
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
	const [selectedDay, setSelectedDay] = useState(null);
	const UserId = useUserDetails((state) => state?.UserId);
	const driverUid = useDriverDetails((state) => state?.uid);
	const PAGE_SIZE = 50;

	const isDriver = !!driverUid && !UserId;
	const userId = isDriver ? driverUid : UserId;

	const getHistory = async () => {
		if (!userId) return;

		setLoading(true);
		setError(false);
		try {
			const result = isDriver
				? await getDriverHistoryPaginated(userId, PAGE_SIZE)
				: await getCustomerHistoryPaginated(userId, PAGE_SIZE);
			setHistory(result.rides);
			setLastVisible(result.lastVisible);
			setHasMore(result.hasMore);
		} catch (err) {
			console.error("❌ Error fetching history:", err);
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	// Older rides beyond the first page — previously there was no way to
	// reach them at all once a rider/driver passed the fixed single-page
	// fetch, so they'd silently vanish from history with no indication.
	const loadMoreHistory = async () => {
		if (!userId || !hasMore || loadingMore) return;

		setLoadingMore(true);
		try {
			const result = isDriver
				? await getDriverHistoryPaginated(userId, PAGE_SIZE, lastVisible)
				: await getCustomerHistoryPaginated(userId, PAGE_SIZE, lastVisible);
			setHistory((prev) => [...prev, ...result.rides]);
			setLastVisible(result.lastVisible);
			setHasMore(result.hasMore);
		} catch (err) {
			console.error("❌ Error loading more history:", err);
		} finally {
			setLoadingMore(false);
		}
	};

	// Re-fetch the first page every time this screen regains focus (not just
	// on mount) — otherwise a ride completed while this screen stayed mounted
	// further down the stack wouldn't show up until something else forced a
	// remount.
	useFocusEffect(
		useCallback(() => {
			getHistory();
		}, [userId, isDriver])
	);

	// Reset day selection when month or year changes
	useEffect(() => {
		setSelectedDay(null);
	}, [selectedMonth, selectedYear]);

	const daysInMonth = useMemo(
		() => new Date(selectedYear, selectedMonth + 1, 0).getDate(),
		[selectedYear, selectedMonth]
	);

	const filteredHistory = useMemo(() => {
		return history.filter((ride) => {
			const raw = ride.completedAt || ride.cancelledAt;
			if (!raw) return false;
			const date = raw.toDate ? raw.toDate() : new Date(raw);
			if (date.getFullYear() !== selectedYear || date.getMonth() !== selectedMonth) return false;
			if (selectedDay !== null && date.getDate() !== selectedDay) return false;
			return true;
		});
	}, [history, selectedYear, selectedMonth, selectedDay]);

	const renderEmpty = () => {
		if (loading) return null;
		const label = selectedDay !== null
			? `${MONTHS[selectedMonth]} ${selectedDay}, ${selectedYear}`
			: `${MONTHS[selectedMonth]} ${selectedYear}`;
		return <Text style={styles.emptyText}>No rides on {label}</Text>;
	};

	return (
		<SafeAreaView style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Ride history</Text>} />

			{/* Year selector */}
			<View style={styles.yearRow}>
				<TouchableOpacity onPress={() => setSelectedYear((y) => y - 1)} style={styles.arrowBtn}>
					<Ionicons name="chevron-back" size={22} color={colors.primaryBlue} />
				</TouchableOpacity>
				<Text style={styles.yearText}>{selectedYear}</Text>
				<TouchableOpacity
					onPress={() => setSelectedYear((y) => y + 1)}
					disabled={selectedYear >= new Date().getFullYear()}
					style={styles.arrowBtn}
				>
					<Ionicons
						name="chevron-forward"
						size={22}
						color={selectedYear >= new Date().getFullYear() ? colors.lightGrey3 : colors.primaryBlue}
					/>
				</TouchableOpacity>
			</View>

			{/* Month pills */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.monthRow}
				style={styles.monthScroll}
			>
				{MONTHS.map((m, i) => {
					const isActive = i === selectedMonth;
					const isFuture =
						selectedYear === new Date().getFullYear() && i > new Date().getMonth();
					return (
						<TouchableOpacity
							key={m}
							disabled={isFuture}
							onPress={() => setSelectedMonth(i)}
							style={[styles.monthPill, isActive && styles.monthPillActive, isFuture && styles.monthPillDisabled]}
						>
							<Text style={[styles.monthText, isActive && styles.monthTextActive, isFuture && styles.monthTextDisabled]}>
								{m}
							</Text>
						</TouchableOpacity>
					);
				})}
			</ScrollView>

			{/* Day picker */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.dayRow}
				style={styles.dayScroll}
			>
				<TouchableOpacity
					onPress={() => setSelectedDay(null)}
					style={[styles.dayPill, selectedDay === null && styles.dayPillActive]}
				>
					<Text style={[styles.dayText, selectedDay === null && styles.dayTextActive]}>All</Text>
				</TouchableOpacity>
				{Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
					const now = new Date();
					const isFuture =
						selectedYear === now.getFullYear() &&
						selectedMonth === now.getMonth() &&
						d > now.getDate();
					const isActive = selectedDay === d;
					return (
						<TouchableOpacity
							key={d}
							disabled={isFuture}
							onPress={() => setSelectedDay(d)}
							style={[styles.dayPill, isActive && styles.dayPillActive, isFuture && styles.dayPillDisabled]}
						>
							<Text style={[styles.dayText, isActive && styles.dayTextActive, isFuture && styles.dayTextDisabled]}>
								{d}
							</Text>
						</TouchableOpacity>
					);
				})}
			</ScrollView>

			{loading ? (
				<ActivityIndicator size={30} color={colors.primaryBlue} style={{ marginTop: 20 }} />
			) : error ? (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>Could not load ride history.</Text>
					<TouchableOpacity style={styles.retryButton} onPress={getHistory}>
						<Text style={styles.retryText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : (
				<FlatList
					data={filteredHistory}
					keyExtractor={(item, index) => item.rideId || index.toString()}
					renderItem={({ item }) => <HistoryCard history={item} />}
					ListHeaderComponent={
						<Text style={styles.monthDate}>
							{selectedDay !== null
								? `${MONTHS[selectedMonth]} ${selectedDay}, ${selectedYear}`
								: `${MONTHS[selectedMonth]} ${selectedYear}`}{' '}
							· {filteredHistory.length} ride{filteredHistory.length !== 1 ? "s" : ""}
						</Text>
					}
					ListEmptyComponent={renderEmpty}
					ListFooterComponent={
						hasMore ? (
							<TouchableOpacity
								style={styles.loadMoreButton}
								onPress={loadMoreHistory}
								disabled={loadingMore}
							>
								{loadingMore ? (
									<ActivityIndicator size={18} color={colors.primaryBlue} />
								) : (
									<Text style={styles.loadMoreText}>Load older rides</Text>
								)}
							</TouchableOpacity>
						) : null
					}
					contentContainerStyle={styles.contentContainer}
					style={{ width, flex: 1 }}
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
	yearRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 16,
		gap: 16,
	},
	arrowBtn: {
		padding: 6,
	},
	yearText: {
		fontSize: 20,
		fontFamily: "Albert-SemiBold",
		color: "black",
		minWidth: 60,
		textAlign: "center",
	},
	monthScroll: {
		height: 44,
		flexGrow: 0,
		flexShrink: 0,
	},
	monthRow: {
		paddingHorizontal: 16,
		alignItems: 'center',
		gap: 8,
	},
	monthPill: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 20,
		backgroundColor: colors.lightGrey2,
	},
	monthPillActive: {
		backgroundColor: colors.primaryBlue,
	},
	monthPillDisabled: {
		opacity: 0.35,
	},
	monthText: {
		fontSize: 13,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey4,
	},
	monthTextActive: {
		color: "white",
	},
	monthTextDisabled: {
		color: colors.lightGrey3,
	},
	dayScroll: {
		height: 40,
		flexGrow: 0,
		flexShrink: 0,
		marginTop: 8,
	},
	dayRow: {
		paddingHorizontal: 16,
		alignItems: 'center',
		gap: 6,
	},
	dayPill: {
		minWidth: 36,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 18,
		backgroundColor: colors.lightGrey2,
		alignItems: 'center',
	},
	dayPillActive: {
		backgroundColor: colors.primaryBlue,
	},
	dayPillDisabled: {
		opacity: 0.35,
	},
	dayText: {
		fontSize: 13,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey4,
	},
	dayTextActive: {
		color: "white",
	},
	dayTextDisabled: {
		color: colors.lightGrey3,
	},
	loadMoreButton: {
		alignSelf: "center",
		marginTop: 16,
		marginBottom: 8,
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: colors.primaryBlue,
		minWidth: 140,
		alignItems: "center",
		justifyContent: "center",
	},
	loadMoreText: {
		fontSize: 14,
		fontFamily: "Albert-SemiBold",
		color: colors.primaryBlue,
	},
	monthDate: {
		marginTop: 8,
		marginBottom: 4,
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
		color: colors.textGrey,
	},
	contentContainer: {
		paddingHorizontal: 16,
		paddingBottom: 24,
	},
	emptyText: {
		textAlign: "center",
		marginTop: 40,
		fontSize: 16,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
	},
	errorContainer: {
		alignItems: "center",
		marginTop: 48,
		paddingHorizontal: 24,
	},
	errorText: {
		fontSize: 16,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
		textAlign: "center",
		marginBottom: 16,
	},
	retryButton: {
		paddingHorizontal: 28,
		paddingVertical: 10,
		backgroundColor: colors.primaryBlue,
		borderRadius: 8,
	},
	retryText: {
		color: "white",
		fontSize: 15,
		fontFamily: "Albert-SemiBold",
	},
});
