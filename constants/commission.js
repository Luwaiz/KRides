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
