import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { calculateDriverEarnings, calculatePlatformFee } from "../constants/commission";

export const getDriverEarnings = async (driverId, period = 'month', year = null, month = null) => {
    try {
        const now = new Date();
        const targetYear = year ?? now.getFullYear();
        const targetMonth = month ?? now.getMonth();
        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 1);

        console.log(`📊 Fetching earnings for driver ${driverId} from ${startDate.toISOString()}`);

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

        rides.sort((a, b) => {
            const aTime = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0;
            const bTime = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0;
            return bTime - aTime;
        });

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

export const formatCurrency = (amount) => {
    return `₦${(Number(amount) || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
