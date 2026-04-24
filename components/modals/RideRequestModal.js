import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Vibration, StatusBar, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/styling';
import { sp, fs, br } from '../../constants/responsive';
import { Ionicons } from '@expo/vector-icons';
import { calculateDriverEarnings } from '../../constants/commission';

const TIMEOUT_SECONDS = 20;

const RideRequestModal = ({ visible, ride, onAccept, onDecline, onTimeout }) => {
    const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
    const [pulseAnim] = useState(new Animated.Value(1));
    const [slideAnim] = useState(new Animated.Value(-200));
    const timerRef = React.useRef(null);

    // Slide in/out animation
    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 80,
                friction: 10,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -200,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

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

    // Pulse animation + haptic for last 5 seconds
    useEffect(() => {
        if (visible && countdown <= 5 && countdown > 0) {
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 200, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }
    }, [countdown, visible]);

    // Haptic on appear
    useEffect(() => {
        if (visible) {
            Vibration.vibrate([0, 200, 100, 200]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
    }, [visible]);

    if (!visible || !ride) return null;

    const handleAccept = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        onAccept(ride.rideId);
    };

    const handleDecline = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        onDecline(ride.rideId);
    };

    const getTimerColor = () => {
        if (countdown <= 5) return '#d32f2f';
        if (countdown <= 10) return '#ff9800';
        return colors.primaryBlue;
    };

    const pickupText = typeof ride.pickupLocation === 'string'
        ? ride.pickupLocation
        : (ride.pickupLocation?.name || ride.pickupLocation?.address || ride.pickupAddress || 'Pickup');

    const destText = typeof ride.destination === 'string'
        ? ride.destination
        : (ride.destination?.name || ride.destination?.address || ride.destinationAddress || 'Destination');

    const earnings = calculateDriverEarnings(ride.amount || 0, ride.numberOfPassengers || 1);

    return (
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
            {/* Top row: icon + title + timer */}
            <View style={styles.topRow}>
                <View style={styles.titleRow}>
                    <Ionicons name="notifications" size={18} color={colors.primaryBlue} />
                    <Text style={styles.title}>New Ride Request</Text>
                    {ride.customerName ? (
                        <Text style={styles.customerName}> · {ride.customerName}</Text>
                    ) : null}
                </View>
                <Animated.Text
                    style={[styles.timer, { color: getTimerColor(), transform: [{ scale: pulseAnim }] }]}
                >
                    {countdown}s
                </Animated.Text>
            </View>

            {/* Route */}
            <View style={styles.routeRow}>
                <View style={styles.routeStop}>
                    <Ionicons name="location" size={14} color="#4caf50" />
                    <Text style={styles.routeText} numberOfLines={1}>{pickupText}</Text>
                </View>
                <Ionicons name="arrow-forward" size={12} color={colors.lightGrey3} style={styles.routeArrow} />
                <View style={styles.routeStop}>
                    <Ionicons name="flag" size={14} color={colors.primaryBlue} />
                    <Text style={styles.routeText} numberOfLines={1}>{destText}</Text>
                </View>
            </View>

            {/* Earnings + buttons */}
            <View style={styles.bottomRow}>
                <View style={styles.earningsBlock}>
                    <Text style={styles.earningsLabel}>Your earnings</Text>
                    <Text style={styles.earningsValue}>₦{earnings}</Text>
                    <Text style={styles.passengersText}>
                        {ride.numberOfPassengers || 1} pax
                    </Text>
                </View>
                <View style={styles.buttonsBlock}>
                    <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.7}>
                        <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.7}>
                        <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        top: (StatusBar.currentHeight || 24) + 152,
        left: sp(12),
        right: sp(12),
        zIndex: 999,
        backgroundColor: 'white',
        borderRadius: br(16),
        padding: sp(14),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 12,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: sp(10),
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        flexWrap: 'wrap',
    },
    title: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: '#333',
        marginLeft: sp(6),
    },
    customerName: {
        fontSize: fs(13),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey4,
    },
    timer: {
        fontSize: fs(20),
        fontFamily: 'Albert-Bold',
        minWidth: 36,
        textAlign: 'right',
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f7f7',
        borderRadius: br(8),
        paddingHorizontal: sp(10),
        paddingVertical: sp(8),
        marginBottom: sp(10),
    },
    routeStop: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: sp(4),
    },
    routeText: {
        fontSize: fs(12),
        fontFamily: 'Albert-Regular',
        color: '#444',
        flex: 1,
    },
    routeArrow: {
        marginHorizontal: sp(6),
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(12),
    },
    earningsBlock: {
        alignItems: 'flex-start',
    },
    earningsLabel: {
        fontSize: fs(11),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey4,
    },
    earningsValue: {
        fontSize: fs(22),
        fontFamily: 'Albert-Bold',
        color: '#4caf50',
    },
    passengersText: {
        fontSize: fs(11),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey4,
    },
    buttonsBlock: {
        flex: 1,
        flexDirection: 'row',
        gap: sp(8),
    },
    declineBtn: {
        flex: 1,
        height: 36,
        borderRadius: br(8),
        backgroundColor: '#fdecea',
        justifyContent: 'center',
        alignItems: 'center',
    },
    declineBtnText: {
        fontSize: fs(13),
        fontFamily: 'Albert-SemiBold',
        color: '#d32f2f',
    },
    acceptBtn: {
        flex: 2,
        height: 36,
        borderRadius: br(8),
        backgroundColor: colors.primaryBlue,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtnText: {
        fontSize: fs(13),
        fontFamily: 'Albert-SemiBold',
        color: 'white',
    },
});

export default RideRequestModal;
