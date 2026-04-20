import { FlatList, StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView } from "react-native";
import React, { useEffect, useState, useMemo } from "react";
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
	const [history, setHistory] = useState([]);
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
	const UserId = useUserDetails((state) => state?.UserId);
	const driverUid = useDriverDetails((state) => state?.uid);

	const getHistory = async () => {
		const isDriver = !!driverUid && !UserId;
		const userId = isDriver ? driverUid : UserId;
		if (!userId) return;

		setLoading(true);
		try {
			const result = isDriver
				? await getDriverHistoryPaginated(userId, 200)
				: await getCustomerHistoryPaginated(userId, 200);
			setHistory(result.rides);
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

	const filteredHistory = useMemo(() => {
		return history.filter((ride) => {
			const raw = ride.completedAt || ride.cancelledAt;
			if (!raw) return false;
			const date = raw.toDate ? raw.toDate() : new Date(raw);
			return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
		});
	}, [history, selectedYear, selectedMonth]);

	const renderEmpty = () => {
		if (loading) return null;
		return (
			<Text style={styles.emptyText}>
				No rides in {MONTHS[selectedMonth]} {selectedYear}
			</Text>
		);
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

			{loading ? (
				<ActivityIndicator size={30} color={colors.primaryBlue} style={{ marginTop: 20 }} />
			) : (
				<FlatList
					data={filteredHistory}
					keyExtractor={(item, index) => item.rideId || index.toString()}
					renderItem={({ item }) => <HistoryCard history={item} />}
					ListHeaderComponent={
						<Text style={styles.monthDate}>
							{MONTHS[selectedMonth]} {selectedYear} · {filteredHistory.length} ride{filteredHistory.length !== 1 ? "s" : ""}
						</Text>
					}
					ListEmptyComponent={renderEmpty}
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
});
