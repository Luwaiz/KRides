import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { calculateDriverEarnings, calculatePlatformFee } from "../constants/commission";

/**
 * Get driver earnings for a specific time period
 * @param {string} driverId - Driver ID
 * @param {string} period - 'today', 'week', 'month', 'year'
 * @returns {Promise<Object>} Earnings data with statistics
 */
export const getDriverEarnings = async (driverId, period = 'month', year = null, month = null) => {
    try {
        const now = new Date();
        const targetYear = year ?? now.getFullYear();
        const targetMonth = month ?? now.getMonth();
        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 1);

        console.log(`📊 Fetching earnings for driver ${driverId} from ${startDate.toISOString()}`);

        // Query completed rides for this driver within the period
        const ridesRef = collection(FIREBASE_DB, "rides");
        const q = query(
            ridesRef,
            where("driverId", "==", driverId),
            where("status", "==", "completed"),
            where("completedAt", ">=", startDate),
            where("completedAt", "<", endDate)
        );

        const snapshot = await getDocs(q);
        const rides = [];

        snapshot.forEach((doc) => {
            rides.push({ ...doc.data(), rideId: doc.id });
        });

        // Sort by completion date (newest first)
        rides.sort((a, b) => {
            const aTime = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0;
            const bTime = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0;
            return bTime - aTime;
        });

        // Calculate earnings — driver sees net only, platform fee is internal
        const totalRides = rides.length;

        let netEarnings = 0;

        rides.forEach(ride => {
            netEarnings += calculateDriverEarnings(ride.amount || 0, ride.numberOfPassengers || 1);
        });

        const averagePerRide = totalRides > 0 ? netEarnings / totalRides : 0;

        console.log(`✅ Calculated earnings: ₦${netEarnings} from ${totalRides} rides`);

        return {
            rides,
            totalRides,
            netEarnings,
            averagePerRide,
            period,
            startDate,
            endDate: endDate,
        };
    } catch (error) {
        console.error("❌ Error getting driver earnings:", error);
        return {
            rides: [],
            totalRides: 0,
            netEarnings: 0,
            averagePerRide: 0,
            period,
            startDate: new Date(),
            endDate: new Date(),
        };
    }
};

/**
 * Format currency for display
 * @param {number} amount - Amount in naira
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
    return `₦${(Number(amount) || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
