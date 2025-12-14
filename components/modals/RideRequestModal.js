import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import ActiveButton from '../buttons/ActiveButton';
import DangerButton from '../buttons/DangerButton';
import { colors } from '../../constants/styling';
import { sp, fs, br } from '../../constants/responsive';
import { Ionicons } from '@expo/vector-icons';
import { calculateDriverEarnings } from '../../constants/commission';

const TIMEOUT_SECONDS = 20;

const RideRequestModal = ({ visible, ride, onAccept, onDecline, onTimeout }) => {
    const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
    const [pulseAnim] = useState(new Animated.Value(1));
    const timerRef = React.useRef(null);

    // Countdown timer
    useEffect(() => {
        if (!visible) {
            setCountdown(TIMEOUT_SECONDS);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    // Use setTimeout to avoid setState during render
                    setTimeout(() => onTimeout(ride?.rideId), 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [visible, ride?.rideId]);

    // Pulse animation for timer
    useEffect(() => {
        if (visible && countdown <= 5) {
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [countdown, visible]);

    // Play sound and vibrate when modal appears
    useEffect(() => {
        if (visible) {
            playNotificationSound();
            triggerHaptic();
        }
    }, [visible]);

    const playNotificationSound = async () => {
        try {
            // Create a simple beep sound programmatically
            const { sound } = await Audio.Sound.createAsync(
                { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' },
                { shouldPlay: true, volume: 1.0 }
            );

            // Cleanup
            setTimeout(() => {
                sound.unloadAsync();
            }, 2000);
        } catch (error) {
            console.log('Error playing sound:', error);
            // Fallback to vibration
            Vibration.vibrate([0, 200, 100, 200]);
        }
    };

    const triggerHaptic = async () => {
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.log('Haptic feedback not available');
        }
    };

    if (!ride) return null;

    const handleAccept = () => {
        // Stop the countdown timer immediately
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        onAccept(ride.rideId);
    };

    const handleDecline = () => {
        // Stop the countdown timer immediately
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        onDecline(ride.rideId);
    };

    const getTimerColor = () => {
        if (countdown <= 5) return '#d32f2f';
        if (countdown <= 10) return '#ff9800';
        return colors.primaryBlue;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Ionicons name="notifications" size={32} color={colors.primaryBlue} />
                    <Text style={styles.headerText}>New Ride Request</Text>
                </View>

                {/* Countdown Timer */}
                <Animated.View
                    style={[
                        styles.timerContainer,
                        { transform: [{ scale: pulseAnim }] }
                    ]}
                >
                    <Text style={[styles.timerText, { color: getTimerColor() }]}>
                        {countdown}
                    </Text>
                    <Text style={styles.timerLabel}>seconds remaining</Text>
                </Animated.View>

                {/* Ride Details Card */}
                <View style={styles.detailsCard}>
                    {/* Customer Info */}
                    <View style={styles.customerSection}>
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={40} color={colors.primaryBlue} />
                        </View>
                        <View style={styles.customerInfo}>
                            <Text style={styles.customerName}>{ride.customerName || 'Customer'}</Text>
                            <Text style={styles.customerMeta}>{ride.numberOfPassengers || 1} passenger(s)</Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Location Details */}
                    <View style={styles.locationSection}>
                        <View style={styles.locationRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="location" size={24} color="#4caf50" />
                            </View>
                            <View style={styles.locationText}>
                                <Text style={styles.locationLabel}>Pickup</Text>
                                <Text style={styles.locationValue} numberOfLines={2}>
                                    {typeof ride.pickupLocation === 'string'
                                        ? ride.pickupLocation
                                        : (ride.pickupLocation?.name || ride.pickupLocation?.address || ride.pickupAddress || 'Pickup location')}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.locationRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="flag" size={24} color="#1976D2" />
                            </View>
                            <View style={styles.locationText}>
                                <Text style={styles.locationLabel}>Destination</Text>
                                <Text style={styles.locationValue} numberOfLines={2}>
                                    {typeof ride.destination === 'string'
                                        ? ride.destination
                                        : (ride.destination?.name || ride.destination?.address || ride.destinationAddress || 'Destination')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Fare Section */}
                    <View style={styles.fareSection}>
                        <View style={styles.fareRow}>
                            <Text style={styles.fareLabel}>Total Fare</Text>
                            <Text style={styles.totalFareValue}>₦{ride.amount || 0}</Text>
                        </View>
                        <View style={styles.fareRow}>
                            <Text style={styles.earningsLabel}>Your Earnings</Text>
                            <Text style={styles.earningsValue}>
                                ₦{calculateDriverEarnings(ride.amount || 0, ride.numberOfPassengers || 1)}
                            </Text>
                        </View>
                        <Text style={styles.feeNote}>
                            Platform fee: ₦{(ride.numberOfPassengers || 1) >= 3 ? '100' : '50'}
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonsContainer}>
                    <View style={styles.declineButtonWrapper}>
                        <DangerButton
                            title="Decline"
                            onPress={handleDecline}
                        />
                    </View>
                    <View style={styles.acceptButtonWrapper}>
                        <ActiveButton
                            title="Accept Ride"
                            onPress={handleAccept}
                        />
                    </View>
                </View>

                {/* Auto-decline warning */}
                <Text style={styles.warningText}>
                    Ride will be automatically declined if not accepted
                </Text>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: sp(20),
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: sp(20),
    },
    headerText: {
        fontSize: fs(24),
        fontWeight: 'bold',
        color: '#333',
        marginTop: sp(10),
    },
    timerContainer: {
        alignItems: 'center',
        marginBottom: sp(30),
    },
    timerText: {
        fontSize: fs(72),
        fontWeight: 'bold',
    },
    timerLabel: {
        fontSize: fs(16),
        color: '#666',
        marginTop: sp(5),
    },
    detailsCard: {
        backgroundColor: 'white',
        borderRadius: br(16),
        padding: sp(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        marginBottom: sp(30),
    },
    customerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: sp(20),
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customerInfo: {
        marginLeft: sp(15),
        flex: 1,
    },
    customerName: {
        fontSize: fs(20),
        fontWeight: 'bold',
        color: '#333',
    },
    customerMeta: {
        fontSize: fs(14),
        color: '#666',
        marginTop: sp(4),
    },
    divider: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginVertical: sp(15),
    },
    locationSection: {
        marginBottom: sp(10),
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: sp(15),
    },
    iconContainer: {
        width: 40,
        alignItems: 'center',
    },
    locationText: {
        flex: 1,
        marginLeft: sp(10),
    },
    locationLabel: {
        fontSize: fs(12),
        color: '#666',
        marginBottom: sp(4),
    },
    locationValue: {
        fontSize: fs(16),
        color: '#333',
        fontWeight: '500',
    },
    fareSection: {
        paddingTop: sp(10),
    },
    fareRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: sp(8),
    },
    fareLabel: {
        fontSize: fs(14),
        color: '#999',
    },
    totalFareValue: {
        fontSize: fs(18),
        fontWeight: '600',
        color: '#666',
        textDecorationLine: 'line-through',
    },
    earningsLabel: {
        fontSize: fs(16),
        fontWeight: '600',
        color: '#333',
    },
    earningsValue: {
        fontSize: fs(32),
        fontWeight: 'bold',
        color: '#4caf50',
    },
    feeNote: {
        fontSize: fs(11),
        color: '#999',
        fontStyle: 'italic',
        marginTop: sp(4),
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: sp(12),
        marginBottom: sp(15),
    },
    declineButtonWrapper: {
        flex: 1,
    },
    acceptButtonWrapper: {
        flex: 2,
    },
    warningText: {
        textAlign: 'center',
        fontSize: fs(12),
        color: '#999',
    },
});

export default RideRequestModal;
