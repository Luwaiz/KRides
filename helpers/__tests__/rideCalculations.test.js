import {
    calculateDistance,
    calculateEstimatedTime,
    formatDistance,
    formatTime,
    calculateFare,
} from '../rideCalculations';

describe('Ride Calculations', () => {
    describe('calculateDistance', () => {
        it('should calculate distance between two coordinates', () => {
            const origin = { latitude: 6.5244, longitude: 3.3792 };
            const destination = { latitude: 6.4541, longitude: 3.3947 };

            const distance = calculateDistance(origin, destination);

            expect(distance).toBeGreaterThan(0);
            expect(typeof distance).toBe('number');
        });

        it('should return 0 for same coordinates', () => {
            const location = { latitude: 6.5244, longitude: 3.3792 };

            const distance = calculateDistance(location, location);

            expect(distance).toBe(0);
        });

        it('should handle null coordinates', () => {
            const distance = calculateDistance(null, null);
            expect(distance).toBe(0);
        });
    });

    describe('calculateEstimatedTime', () => {
        it('should calculate time for given distance', () => {
            const distance = 10; // km

            const time = calculateEstimatedTime(distance);

            expect(time).toBeGreaterThan(0);
            expect(typeof time).toBe('number');
        });

        it('should return minimum 2 minutes for short distances', () => {
            const distance = 0.1; // km

            const time = calculateEstimatedTime(distance);

            expect(time).toBeGreaterThanOrEqual(2);
        });

        it('should return 0 for zero distance', () => {
            const time = calculateEstimatedTime(0);
            expect(time).toBe(0);
        });
    });

    describe('formatDistance', () => {
        it('should format kilometers correctly', () => {
            const formatted = formatDistance(5.5);
            expect(formatted).toBe('5.5 km');
        });

        it('should format meters for distances less than 1km', () => {
            const formatted = formatDistance(0.5);
            expect(formatted).toBe('500 m');
        });

        it('should handle zero distance', () => {
            const formatted = formatDistance(0);
            expect(formatted).toBe('0 km');
        });
    });

    describe('formatTime', () => {
        it('should format minutes correctly', () => {
            const formatted = formatTime(30);
            expect(formatted).toBe('30 min');
        });

        it('should format hours and minutes', () => {
            const formatted = formatTime(90);
            expect(formatted).toBe('1 hr 30 min');
        });

        it('should format exact hours', () => {
            const formatted = formatTime(120);
            expect(formatted).toBe('2 hr');
        });

        it('should handle zero time', () => {
            const formatted = formatTime(0);
            expect(formatted).toBe('0 min');
        });
    });

    describe('calculateFare', () => {
        it('should calculate fare for 1 passenger', () => {
            const fare = calculateFare(5, 1);
            expect(fare).toBe(250); // 200 + 50
        });

        it('should calculate fare for 2 passengers', () => {
            const fare = calculateFare(5, 2);
            expect(fare).toBe(450); // 400 + 50
        });

        it('should calculate fare for 3+ passengers', () => {
            const fare = calculateFare(5, 3);
            expect(fare).toBe(700); // 600 + 100
        });

        it('should calculate fare for 4 passengers', () => {
            const fare = calculateFare(5, 4);
            expect(fare).toBe(900); // 800 + 100
        });
    });
});
