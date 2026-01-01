import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Get driver earnings for a specific time period
 * @param {string} driverId - Driver ID
 * @param {string} period - 'today', 'week', 'month', 'year'
 * @returns {Promise<Object>} Earnings data with statistics
 */
export const getDriverEarnings = async (driverId, period = 'month') => {
    try {
        const now = new Date();
        let startDate;

        // Calculate start date based on period
        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                startDate = new Date(now);
                startDate.setDate(now.getDate() - dayOfWeek);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        console.log(`📊 Fetching earnings for driver ${driverId} from ${startDate.toISOString()}`);

        // Query completed rides for this driver within the period
        const ridesRef = collection(FIREBASE_DB, "rides");
        const q = query(
            ridesRef,
            where("driverId", "==", driverId),
            where("status", "==", "completed"),
            where("completedAt", ">=", startDate)
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

        // Calculate earnings
        const totalRides = rides.length;
        const platformFeePerRide = 50; // ₦50 platform fee per ride

        let grossEarnings = 0;
        let platformFees = 0;

        rides.forEach(ride => {
            const amount = ride.amount || 0;
            grossEarnings += amount;
            platformFees += platformFeePerRide;
        });

        const netEarnings = grossEarnings - platformFees;
        const averagePerRide = totalRides > 0 ? grossEarnings / totalRides : 0;

        console.log(`✅ Calculated earnings: ₦${netEarnings} from ${totalRides} rides`);

        return {
            rides,
            totalRides,
            grossEarnings,
            platformFees,
            netEarnings,
            averagePerRide,
            period,
            startDate,
            endDate: now,
        };
    } catch (error) {
        console.error("❌ Error getting driver earnings:", error);
        return {
            rides: [],
            totalRides: 0,
            grossEarnings: 0,
            platformFees: 0,
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
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
