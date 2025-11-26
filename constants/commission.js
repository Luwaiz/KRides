// Platform commission configuration
export const PLATFORM_FEE = 50; // Platform takes 50 naira per ride

/**
 * Calculate driver's earnings from total ride amount
 * @param {number} totalAmount - Total ride price paid by customer
 * @returns {number} Driver's earnings after platform fee
 */
export const calculateDriverEarnings = (totalAmount) => {
    if (!totalAmount || totalAmount <= 0) return 0;
    const driverEarnings = totalAmount - PLATFORM_FEE;
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
