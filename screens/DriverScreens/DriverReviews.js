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
import { AntDesign } from "@expo/vector-icons";
import BackButton from "../../components/buttons/BackButton";
import { colors } from "../../constants/styling";
import { sp, fs, br, ms } from "../../constants/responsive";
import { getDriverRatings } from "../../helpers/driverRatings";
import { useDriverDetails } from "../../constants/Store";

const DriverReviews = () => {
    const { uid } = useDriverDetails((state) => ({
        uid: state.uid,
    }));

    const [loading, setLoading] = useState(true);
    const [ratingsData, setRatingsData] = useState({
        ratings: [],
        totalRatings: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    const [selectedFilter, setSelectedFilter] = useState("all");

    useEffect(() => {
        fetchRatings();
    }, [uid]);

    const fetchRatings = async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const data = await getDriverRatings(uid);
            setRatingsData(data);
        } catch (error) {
            console.error("Error fetching ratings:", error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredRatings = () => {
        if (selectedFilter === "all") {
            return ratingsData.ratings;
        }
        const filterValue = parseInt(selectedFilter);
        return ratingsData.ratings.filter((r) => r.rating === filterValue);
    };

    const formatDate = (date) => {
        if (!date) return "";
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const renderStars = (rating) => {
        return (
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <AntDesign
                        key={star}
                        name="star"
                        size={ms(16)}
                        color={star <= rating ? "#FFD700" : colors.lightGrey3}
                        style={{ marginRight: sp(2) }}
                    />
                ))}
            </View>
        );
    };

    const renderRatingBar = (stars) => {
        const count = ratingsData.ratingDistribution[stars] || 0;
        const percentage =
            ratingsData.totalRatings > 0
                ? (count / ratingsData.totalRatings) * 100
                : 0;

        return (
            <View style={styles.ratingBarRow}>
                <Text style={styles.ratingBarLabel}>{stars}★</Text>
                <View style={styles.ratingBarContainer}>
                    <View
                        style={[styles.ratingBarFill, { width: `${percentage}%` }]}
                    />
                </View>
                <Text style={styles.ratingBarCount}>{count}</Text>
            </View>
        );
    };

    const filteredRatings = getFilteredRatings();

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <BackButton
                    text={<Text style={styles.headText}>Ratings & Reviews</Text>}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primaryBlue} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <BackButton
                text={<Text style={styles.headText}>Ratings & Reviews</Text>}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Overall Rating Section */}
                <View style={styles.overallSection}>
                    <Text style={styles.averageRating}>
                        {ratingsData.averageRating.toFixed(1)}
                    </Text>
                    {renderStars(Math.round(ratingsData.averageRating))}
                    <Text style={styles.totalRatingsText}>
                        Based on {ratingsData.totalRatings} review
                        {ratingsData.totalRatings !== 1 ? "s" : ""}
                    </Text>
                </View>

                {ratingsData.totalRatings > 0 && (
                    <View style={styles.distributionSection}>
                        <Text style={styles.sectionTitle}>Rating Distribution</Text>
                        {[5, 4, 3, 2, 1].map((stars) => (
                            <View key={stars}>
                                {renderRatingBar(stars)}
                            </View>
                        ))}
                    </View>
                )}

                {/* Filter Tabs */}
                {ratingsData.totalRatings > 0 && (
                    <View style={styles.filterSection}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterTabs}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.filterTab,
                                    selectedFilter === "all" && styles.filterTabActive,
                                ]}
                                onPress={() => setSelectedFilter("all")}
                            >
                                <Text
                                    style={[
                                        styles.filterTabText,
                                        selectedFilter === "all" && styles.filterTabTextActive,
                                    ]}
                                >
                                    All ({ratingsData.totalRatings})
                                </Text>
                            </TouchableOpacity>
                            {[5, 4, 3, 2, 1].map((stars) => {
                                const count = ratingsData.ratingDistribution[stars] || 0;
                                if (count === 0) return null;
                                return (
                                    <TouchableOpacity
                                        key={stars}
                                        style={[
                                            styles.filterTab,
                                            selectedFilter === String(stars) &&
                                            styles.filterTabActive,
                                        ]}
                                        onPress={() => setSelectedFilter(String(stars))}
                                    >
                                        <Text
                                            style={[
                                                styles.filterTabText,
                                                selectedFilter === String(stars) &&
                                                styles.filterTabTextActive,
                                            ]}
                                        >
                                            {stars}★ ({count})
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Reviews List */}
                <View style={styles.reviewsSection}>
                    {filteredRatings.length === 0 ? (
                        <View style={styles.emptyState}>
                            <AntDesign
                                name="staro"
                                size={ms(64)}
                                color={colors.lightGrey3}
                            />
                            <Text style={styles.emptyStateText}>
                                {selectedFilter === "all"
                                    ? "No reviews yet"
                                    : `No ${selectedFilter}-star reviews`}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                {selectedFilter === "all"
                                    ? "Complete rides to receive customer feedback"
                                    : "Try selecting a different rating filter"}
                            </Text>
                        </View>
                    ) : (
                        filteredRatings.map((review, index) => (
                            <View key={review.rideId || `review-${index}-${review.createdAt?.seconds || index}`} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    {renderStars(review.rating)}
                                    <Text style={styles.reviewDate}>
                                        {formatDate(review.createdAt)}
                                    </Text>
                                </View>
                                {review.feedback && review.feedback.trim() !== "" && (
                                    <Text style={styles.reviewFeedback}>{review.feedback}</Text>
                                )}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverReviews;

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
    overallSection: {
        alignItems: "center",
        paddingVertical: sp(32),
        backgroundColor: "white",
        marginHorizontal: sp(16),
        marginTop: sp(16),
        borderRadius: br(16),
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    averageRating: {
        fontSize: fs(48),
        fontFamily: "Albert-Bold",
        color: colors.primaryBlue,
        marginBottom: sp(8),
    },
    starsRow: {
        flexDirection: "row",
        marginBottom: sp(8),
    },
    totalRatingsText: {
        fontSize: fs(14),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
    },
    distributionSection: {
        backgroundColor: "white",
        marginHorizontal: sp(16),
        marginTop: sp(16),
        padding: sp(16),
        borderRadius: br(16),
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: fs(18),
        fontFamily: "Albert-SemiBold",
        color: "black",
        marginBottom: sp(16),
    },
    ratingBarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: sp(8),
    },
    ratingBarLabel: {
        fontSize: fs(14),
        fontFamily: "Albert-Medium",
        color: "black",
        width: sp(30),
    },
    ratingBarContainer: {
        flex: 1,
        height: sp(8),
        backgroundColor: colors.lightGrey2,
        borderRadius: br(4),
        marginHorizontal: sp(8),
        overflow: "hidden",
    },
    ratingBarFill: {
        height: "100%",
        backgroundColor: "#FFD700",
        borderRadius: br(4),
    },
    ratingBarCount: {
        fontSize: fs(14),
        fontFamily: "Albert-Medium",
        color: colors.textGrey,
        width: sp(30),
        textAlign: "right",
    },
    filterSection: {
        marginTop: sp(16),
        marginBottom: sp(8),
    },
    filterTabs: {
        paddingHorizontal: sp(16),
        gap: sp(8),
    },
    filterTab: {
        paddingHorizontal: sp(16),
        paddingVertical: sp(10),
        borderRadius: br(20),
        backgroundColor: colors.lightGrey2,
        marginRight: sp(8),
    },
    filterTabActive: {
        backgroundColor: colors.primaryBlue,
    },
    filterTabText: {
        fontSize: fs(14),
        fontFamily: "Albert-Medium",
        color: colors.textGrey,
    },
    filterTabTextActive: {
        color: "white",
    },
    reviewsSection: {
        paddingHorizontal: sp(16),
        marginTop: sp(8),
    },
    reviewCard: {
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
    reviewHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: sp(8),
    },
    reviewDate: {
        fontSize: fs(12),
        fontFamily: "Albert-Regular",
        color: colors.textGrey,
    },
    reviewFeedback: {
        fontSize: fs(14),
        fontFamily: "Albert-Regular",
        color: "#333",
        lineHeight: fs(20),
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
        textAlign: "center",
        paddingHorizontal: sp(32),
    },
});
