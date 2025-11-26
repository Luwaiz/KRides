import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { calculateDriverEarnings } from "../constants/commission";

/**
 * Get driver statistics for today
 * @param {string} driverId - Driver ID
 * @returns {Promise<{completedTrips: number, earnedToday: number}>}
 */
export const getDriverTodayStats = async (driverId) => {
    try {
        if (!driverId) {
            console.warn("⚠️ No driver ID provided for stats");
            return { completedTrips: 0, earnedToday: 0 };
        }

        // Get start and end of today
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        console.log("📊 Fetching driver stats for:", driverId);
        console.log("   - Date range:", startOfDay.toISOString(), "to", endOfDay.toISOString());

        const ridesRef = collection(FIREBASE_DB, "rides");

        // Query for completed rides by this driver today
        const completedQuery = query(
            ridesRef,
            where("driverId", "==", driverId),
            where("status", "==", "completed")
        );

        const snapshot = await getDocs(completedQuery);

        let completedTrips = 0;
        let earnedToday = 0;

        snapshot.forEach((doc) => {
            const ride = doc.data();
            const completedAt = ride.completedAt?.toDate();

            // Check if ride was completed today
            if (completedAt && completedAt >= startOfDay && completedAt < endOfDay) {
                completedTrips++;
                // Calculate driver earnings (after commission)
                const driverEarnings = calculateDriverEarnings(ride.amount);
                earnedToday += driverEarnings;
            }
        });

        console.log("✅ Driver stats fetched:");
        console.log("   - Completed trips today:", completedTrips);
        console.log("   - Earned today: ₦", earnedToday);

        return {
            completedTrips,
            earnedToday: Math.round(earnedToday), // Round to nearest naira
        };
    } catch (error) {
        console.error("❌ Error fetching driver stats:", error);
        return { completedTrips: 0, earnedToday: 0 };
    }
};
