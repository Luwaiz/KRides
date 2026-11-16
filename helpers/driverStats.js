import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getRideDriverEarnings } from "../constants/commission";

export const getDriverTodayStats = async (driverId) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const ridesRef = collection(FIREBASE_DB, "rides");

        // Only today's rides, not every ride the driver has ever completed.
        const completedQuery = query(
            ridesRef,
            where("driverId", "==", driverId),
            where("status", "==", "completed"),
            where("completedAt", ">=", startOfToday)
        );

        const snapshot = await getDocs(completedQuery);

        let completedTrips = 0;
        let earnedToday = 0;

        snapshot.forEach((doc) => {
            const ride = doc.data();

            const completedAt = ride.completedAt?.toDate();
            if (completedAt && completedAt >= startOfToday) {
                completedTrips++;
                earnedToday += getRideDriverEarnings(ride);
            }
        });

        console.log(`📊 Driver stats for today: ${completedTrips} trips, ₦${earnedToday.toFixed(2)} earned`);

        return {
            completedTrips,
            earnedToday: Math.round(earnedToday),
        };
    } catch (error) {
        console.error("❌ Error getting driver today stats:", error);
        return {
            completedTrips: 0,
            earnedToday: 0,
        };
    }
};

export const getDriverAllTimeStats = async (driverId) => {
    try {
        const ridesRef = collection(FIREBASE_DB, "rides");

        const completedQuery = query(
            ridesRef,
            where("driverId", "==", driverId),
            where("status", "==", "completed")
        );

        const snapshot = await getDocs(completedQuery);

        let totalTrips = 0;
        let totalEarnings = 0;
        let totalRating = 0;
        let ratedTrips = 0;

        snapshot.forEach((doc) => {
            const ride = doc.data();
            totalTrips++;
            totalEarnings += getRideDriverEarnings(ride);

            if (ride.driverRating) {
                totalRating += ride.driverRating;
                ratedTrips++;
            }
        });

        const averageRating = ratedTrips > 0 ? totalRating / ratedTrips : 0;

        console.log(`📊 Driver all-time stats: ${totalTrips} trips, ₦${totalEarnings.toFixed(2)} earned`);

        return {
            totalTrips,
            totalEarnings: Math.round(totalEarnings),
            averageRating: parseFloat(averageRating.toFixed(1)),
        };
    } catch (error) {
        console.error("❌ Error getting driver all-time stats:", error);
        return {
            totalTrips: 0,
            totalEarnings: 0,
            averageRating: 0,
        };
    }
};
