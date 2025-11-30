// Platform commission configuration
export const PLATFORM_FEE = 50; // Platform takes 50 naira per ride

/**
 * Calculate driver's earnings from total ride amount
 * @param {number} totalAmount - Total ride price paid by customer
 * @param {number} numberOfPassengers - Number of passengers (default: 1)
 * @returns {number} Driver's earnings after platform fee
 */
export const calculateDriverEarnings = (totalAmount, numberOfPassengers = 1) => {
    if (!totalAmount || totalAmount <= 0) return 0;

    // Dynamic platform fee based on passenger count
    // < 3 passengers: 50 naira
    // >= 3 passengers: 100 naira
    const fee = numberOfPassengers >= 3 ? 100 : 50;

    const driverEarnings = totalAmount - fee;
    return Math.max(driverEarnings, 0); // Ensure never negative
};

/**
 * Calculate platform's commission from total ride amount
 * @param {number} totalAmount - Total ride price paid by customer
 * @returns {number} Platform's commission
 */
export const calculatePlatformFee = (totalAmount) => {
    if (!totalAmount || totalAmount <= PLATFORM_FEE) return totalAmount;
    return PLATFORM_FEE;
};
