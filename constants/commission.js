import { getPricingConfig } from "./pricingState";

export const calculateDriverEarnings = (totalAmount, numberOfPassengers = 1) => {
    if (!totalAmount || totalAmount <= 0) return 0;
    const { platformFeeStandard, platformFeeGroup, groupThreshold } = getPricingConfig();
    const fee = numberOfPassengers >= groupThreshold ? platformFeeGroup : platformFeeStandard;
    return Math.max(totalAmount - fee, 0);
};

export const calculatePlatformFee = (totalAmount, numberOfPassengers = 1) => {
    if (!totalAmount || totalAmount <= 0) return 0;
    const { platformFeeStandard, platformFeeGroup, groupThreshold } = getPricingConfig();
    return numberOfPassengers >= groupThreshold ? platformFeeGroup : platformFeeStandard;
};

// What a driver earned (or will earn) on a ride. A completed ride carries the figure the
// server worked out at completion, which is what gets paid out, so use that: recalculating
// from today's fee settings would change past rides if the fees were ever edited. Rides
// without it (not yet completed, or completed before it was recorded) are calculated.
export const getRideDriverEarnings = (ride) => {
    if (!ride) return 0;
    if (typeof ride.driverEarnings === "number" && Number.isFinite(ride.driverEarnings)) {
        return Math.max(ride.driverEarnings, 0);
    }
    const passengers = ride.numberOfPassengers || ride.number_of_passengers || 1;
    return calculateDriverEarnings(Number(ride.amount) || 0, passengers);
};

// Naira with thousands separators, e.g. ₦1,500, so every screen shows money the same way.
export const formatNaira = (amount) => {
    const value = Math.round(Number(amount) || 0);
    return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
};
