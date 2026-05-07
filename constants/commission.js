export const calculateDriverEarnings = (totalAmount, numberOfPassengers = 1) => {
    if (!totalAmount || totalAmount <= 0) return 0;
    const fee = numberOfPassengers >= 3 ? 150 : 100;
    return Math.max(totalAmount - fee, 0);
};

export const calculatePlatformFee = (totalAmount, numberOfPassengers = 1) => {
    if (!totalAmount || totalAmount <= 0) return 0;
    return numberOfPassengers >= 3 ? 150 : 100;
};
