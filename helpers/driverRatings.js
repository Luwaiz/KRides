import { FIREBASE_DB } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

/**
 * Get driver ratings and reviews
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object>} Ratings data with statistics
 */
export const getDriverRatings = async (driverId) => {
    try {
        const driverRef = doc(FIREBASE_DB, "drivers", driverId);
        const driverDoc = await getDoc(driverRef);

        if (!driverDoc.exists()) {
            return {
                ratings: [],
                totalRatings: 0,
                averageRating: 0,
                ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            };
        }

        const driverData = driverDoc.data();
        const ratings = driverData.ratings || [];

        // Calculate statistics
        const totalRatings = ratings.length;
        const ratingSum = ratings.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRatings > 0 ? ratingSum / totalRatings : 0;

        // Calculate distribution
        const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        ratings.forEach(r => {
            if (r.rating >= 1 && r.rating <= 5) {
                ratingDistribution[r.rating]++;
            }
        });

        // Sort ratings by date (newest first)
        const sortedRatings = ratings.sort((a, b) => {
            const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bDate - aDate;
        });

        console.log(`📊 Fetched ${totalRatings} ratings for driver ${driverId}`);
        return {
            ratings: sortedRatings,
            totalRatings,
            averageRating,
            ratingDistribution
        };
    } catch (error) {
        console.error("❌ Error getting driver ratings:", error);
        return {
            ratings: [],
            totalRatings: 0,
            averageRating: 0,
            ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        };
    }
};
