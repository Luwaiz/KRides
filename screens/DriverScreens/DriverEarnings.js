import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, FontAwesome5, Ionicons } from "@expo/vector-icons";
import BackButton from "../../components/buttons/BackButton";
import { colors } from "../../constants/styling";
import { sp, fs, br, ms } from "../../constants/responsive";
import { getDriverEarnings, formatCurrency } from "../../helpers/driverEarnings";
import { useDriverDetails } from "../../constants/Store";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DriverEarnings = () => {
    const { uid } = useDriverDetails((state) => ({
        uid: state.uid,
    }));

    const [initialLoading, setInitialLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [earningsData, setEarningsData] = useState({
        rides: [],
        totalRides: 0,
        grossEarnings: 0,
        platformFees: 0,
        netEarnings: 0,
        averagePerRide: 0,
    });

    useEffect(() => {
        fetchEarnings();
    }, [uid, selectedYear, selectedMonth]);

    const fetchEarnings = async () => {
        if (!uid) return;
        if (initialLoading) {
            // first load — show full-screen spinner
        } else {
            setFetching(true);
        }
        try {
            const data = await getDriverEarnings(uid, "month", selectedYear, selectedMonth);
            setEarningsData(data);
        } catch (error) {
            console.error("Error fetching earnings:", error);
        } finally {
            setInitialLoading(false);
            setFetching(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return "";
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getPeriodLabel = () => `${MONTHS[selectedMonth]} ${selectedYear}`;

    if (initialLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <BackButton text={<Text style={styles.headText}>Earnings</Text>} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primaryBlue} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <BackButton text={<Text style={styles.headText}>Earnings</Text>} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
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
                    contentContainerStyle={styles.filterTabs}
                    style={styles.monthScroll}
                >
                    {MONTHS.map((m, i) => {
                        const isActive = i === selectedMonth;
                        const isFuture = selectedYear === new Date().getFullYear() && i > new Date().getMonth();
                        return (
                            <TouchableOpacity
                                key={m}
                                disabled={isFuture}
                                onPress={() => setSelectedMonth(i)}
                                style={[styles.filterTab, isActive && styles.filterTabActive, isFuture && { opacity: 0.35 }]}
                            >
                                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                                    {m}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Earnings Summary Card */}
                <View style={styles.summaryCard}>
                    <Text style={styles.periodLabel}>{getPeriodLabel()}</Text>
                    {fetching ? (
                        <ActivityIndicator size="large" color={colors.primaryBlue} style={{ marginVertical: sp(24) }} />
                    ) : (
                        <>
                            <Text style={styles.netEarnings}>
                                {formatCurrency(earningsData.netEarnings)}
                            </Text>
                            <Text style={styles.netEarningsLabel}>Net Earnings</Text>

                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <FontAwesome5 name="car" size={20} color={colors.primaryBlue} />
                                    <Text style={styles.statValue}>{earningsData.totalRides}</Text>
                                    <Text style={styles.statLabel}>Rides</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <MaterialIcons
                                        name="attach-money"
                                        size={24}
                                        color={colors.primaryBlue}
                                    />
                                    <Text style={styles.statValue}>
                                        {formatCurrency(earningsData.averagePerRide)}
                                    </Text>
                                    <Text style={styles.statLabel}>Avg/Ride</Text>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* Earnings Breakdown + Transactions — hidden while re-fetching */}
                {!fetching && (
                <>
                <View style={styles.breakdownCard}>
                    <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Gross Earnings</Text>
                        <Text style={styles.breakdownValue}>
                            {formatCurrency(earningsData.grossEarnings)}
                        </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Platform Fees</Text>
                        <Text style={[styles.breakdownValue, styles.feeValue]}>
                            -{formatCurrency(earningsData.platformFees)}
                        </Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabelBold}>Net Earnings</Text>
                        <Text style={styles.breakdownValueBold}>
                            {formatCurrency(earningsData.netEarnings)}
                        </Text>
                    </View>
                </View>

                {/* Transaction List */}
                <View style={styles.transactionsSection}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    {earningsData.rides.length === 0 ? (
                        <View style={styles.emptyState}>
                            <FontAwesome5
                                name="wallet"
                                size={ms(64)}
                                color={colors.lightGrey3}
                            />
                            <Text style={styles.emptyStateText}>No earnings yet</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Complete rides to start earning
                            </Text>
                        </View>
                    ) : (
                        earningsData.rides.map((ride, index) => (
                            <View key={index} style={styles.transactionCard}>
                                <View style={styles.transactionHeader}>
                                    <View style={styles.transactionIcon}>
                                        <FontAwesome5
                                            name="check-circle"
                                            size={20}
                                            color="#4CAF50"
                                        />
                                    </View>
                                    <View style={styles.transactionInfo}>
                                        <Text style={styles.transactionTitle}>
                                            Ride Completed
                                        </Text>
                                        <Text style={styles.transactionDate}>
                                            {formatDate(ride.completedAt)}
                                        </Text>
                                    </View>
                                    <Text style={styles.transactionAmount}>
                                        {formatCurrency(ride.amount)}
                                    </Text>
                                </View>
                                {ride.pickupAddress && ride.destinationAddress && (
                                    <View style={styles.transactionRoute}>
                                        <Text style={styles.routeText} numberOfLines={1}>
                                            {ride.pickupAddress} → {ride.destinationAddress}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                </View>
                </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverEarnings;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.secondary,
        paddingTop: StatusBar.currentHeight,
    },
    headText: {
        color: "black",
        fontSize: fs(24),
        fontFamily: "Albert-SemiBold",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: sp(24),
    },
    yearRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: sp(16),
        gap: sp(16),
    },
    arrowBtn: {
        padding: sp(6),
    },
    yearText: {
        fontSize: fs(20),
        fontFamily: "Albert-SemiBold",
        color: "black",
        minWidth: 60,
        textAlign: "center",
    },
    monthScroll: {
        height: sp(44),
        flexGrow: 0,
        flexShrink: 0,
    },
    filterTabs: {
        paddingHorizontal: sp(16),
        alignItems: 'center',
        gap: sp(8),
    },
    filterTab: {
        paddingHorizontal: sp(14),
        paddingVertical: sp(7),
        borderRadius: br(20),
        backgroundColor: colors.lightGrey2,
        marginRight: sp(8),
    },
    filterTabActive: {
        backgroundColor: colors.primaryBlue,
    },
    filterTabText: {
        fontSize: fs(13),
        fontFamily: "Albert-Regular",
        color: colors.lightGrey4,
    },
    filterTabTextActive: {
        color: "white",
    },
    summaryCard: {
        backgroundColor: "white",
        marginHorizontal: sp(16),
        marginTop: sp(16),
        padding: sp(24),
        borderRadius: br(16),
        alignItems: "center",
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    periodLabel: {
        fontSize: fs(14),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
        marginBottom: sp(8),
    },
    netEarnings: {
        fontSize: fs(40),
        fontFamily: "Albert-Bold",
        color: colors.primaryBlue,
        marginBottom: sp(4),
    },
    netEarningsLabel: {
        fontSize: fs(16),
        fontFamily: "Albert-Medium",
        color: colors.textGrey,
        marginBottom: sp(24),
    },
    statsRow: {
        flexDirection: "row",
        width: "100%",
        justifyContent: "space-around",
        alignItems: "center",
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statDivider: {
        width: 1,
        height: sp(50),
        backgroundColor: colors.lightGrey2,
    },
    statValue: {
        fontSize: fs(20),
        fontFamily: "Albert-Bold",
        color: "black",
        marginTop: sp(8),
    },
    statLabel: {
        fontSize: fs(12),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
        marginTop: sp(4),
    },
    breakdownCard: {
        backgroundColor: "white",
        marginHorizontal: sp(16),
        marginTop: sp(16),
        padding: sp(20),
        borderRadius: br(16),
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    sectionTitle: {
        fontSize: fs(18),
        fontFamily: "Albert-SemiBold",
        color: "black",
        marginBottom: sp(16),
    },
    breakdownRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: sp(12),
    },
    breakdownLabel: {
        fontSize: fs(14),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
    },
    breakdownValue: {
        fontSize: fs(14),
        fontFamily: "Albert-Medium",
        color: "black",
    },
    feeValue: {
        color: "#FF5252",
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: colors.lightGrey2,
        marginVertical: sp(8),
    },
    breakdownLabelBold: {
        fontSize: fs(16),
        fontFamily: "Albert-SemiBold",
        color: "black",
    },
    breakdownValueBold: {
        fontSize: fs(16),
        fontFamily: "Albert-Bold",
        color: colors.primaryBlue,
    },
    transactionsSection: {
        paddingHorizontal: sp(16),
        marginTop: sp(16),
    },
    transactionCard: {
        backgroundColor: "white",
        padding: sp(16),
        borderRadius: br(12),
        marginBottom: sp(12),
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    transactionHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    transactionIcon: {
        marginRight: sp(12),
    },
    transactionInfo: {
        flex: 1,
    },
    transactionTitle: {
        fontSize: fs(14),
        fontFamily: "Albert-SemiBold",
        color: "black",
        marginBottom: sp(2),
    },
    transactionDate: {
        fontSize: fs(12),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
    },
    transactionAmount: {
        fontSize: fs(16),
        fontFamily: "Albert-Bold",
        color: colors.primaryBlue,
    },
    transactionRoute: {
        marginTop: sp(8),
        paddingTop: sp(8),
        borderTopWidth: 1,
        borderTopColor: colors.lightGrey2,
    },
    routeText: {
        fontSize: fs(12),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: sp(48),
    },
    emptyStateText: {
        fontSize: fs(18),
        fontFamily: "Albert-SemiBold",
        color: colors.textGrey,
        marginTop: sp(16),
    },
    emptyStateSubtext: {
        fontSize: fs(14),
        fontFamily: "Albert-Regular",
        color: colors.lightGrey3,
        marginTop: sp(8),
    },
});
