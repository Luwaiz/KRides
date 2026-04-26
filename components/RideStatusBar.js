import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/styling';
import { sp, fs, br } from '../constants/responsive';

const NO_DRIVER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const STILL_SEARCHING_TIMEOUT_MS = 90 * 1000; // 1.5 minutes

const RideStatusBar = ({
    status,
    driverName,
    driverPhone,
    vehicleId,
    onCancel,
    onViewDetails,
    cancelling,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [noDriverAvailable, setNoDriverAvailable] = useState(false);
    const [stillSearching, setStillSearching] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const noDriverTimerRef = useRef(null);
    const stillSearchingTimerRef = useRef(null);
    // Guards timer callbacks so a stale fire after status change is ignored
    const isPendingRef = useRef(false);

    useEffect(() => {
        if (status === 'pending') {
            isPendingRef.current = true;

            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            pulse.start();

            setNoDriverAvailable(false);
            setStillSearching(false);

            stillSearchingTimerRef.current = setTimeout(() => {
                if (isPendingRef.current) setStillSearching(true);
            }, STILL_SEARCHING_TIMEOUT_MS);

            noDriverTimerRef.current = setTimeout(() => {
                if (isPendingRef.current) setNoDriverAvailable(true);
            }, NO_DRIVER_TIMEOUT_MS);

            return () => {
                isPendingRef.current = false;
                pulse.stop();
                clearTimeout(stillSearchingTimerRef.current);
                clearTimeout(noDriverTimerRef.current);
            };
        } else {
            isPendingRef.current = false;
            pulseAnim.setValue(1);
            setNoDriverAvailable(false);
            setStillSearching(false);
            clearTimeout(stillSearchingTimerRef.current);
            clearTimeout(noDriverTimerRef.current);
        }
    }, [status]);


    const getStatusText = () => {
        if (status === 'pending' && noDriverAvailable) {
            return 'No drivers nearby — you can cancel and try again';
        }
        if (status === 'pending' && stillSearching) {
            return 'Taking a little longer — still searching...';
        }
        switch (status) {
            case 'pending':
                return 'Searching for driver...';
            case 'accepted':
                return `${driverName || 'Driver'} is on the way!`;
            case 'in_progress':
                return `Ride in progress with ${driverName || 'your driver'}`;
            default:
                return 'Processing...';
        }
    };

    const getStatusIcon = () => {
        return status === 'pending' ? 'search' : 'car';
    };

    const callDriver = () => {
        if (!driverPhone) return;
        Linking.openURL(`tel:${driverPhone}`).catch(() => {
            Alert.alert('Cannot Call', 'Unable to open the phone dialer.');
        });
    };

    const toggleExpanded = () => {
        setExpanded(!expanded);
        if (onViewDetails) {
            onViewDetails();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.mainBar}>
                <View style={styles.content}>
                    <Animated.View style={{ opacity: status === 'pending' ? pulseAnim : 1 }}>
                        <Ionicons
                            name={getStatusIcon()}
                            size={20}
                            color={colors.primaryBlue}
                        />
                    </Animated.View>
                    <Text style={styles.statusText} numberOfLines={1}>
                        {getStatusText()}
                    </Text>
                </View>

                <View style={styles.actions}>
                    {status === 'pending' ? (
                        <TouchableOpacity
                            onPress={onCancel}
                            disabled={cancelling}
                            style={styles.cancelButton}
                        >
                            {cancelling ? (
                                <View style={styles.cancellingRow}>
                                    <ActivityIndicator size="small" color="#d32f2f" />
                                    <Text style={styles.cancelText}>Cancelling...</Text>
                                </View>
                            ) : (
                                <Text style={styles.cancelText}>Cancel</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.driverActions}>
                            {driverPhone && (
                                <TouchableOpacity onPress={callDriver} style={styles.callButton}>
                                    <Ionicons name="call" size={18} color="#fff" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={toggleExpanded} style={styles.viewButton}>
                                <Text style={styles.viewText}>View</Text>
                                <Ionicons
                                    name={expanded ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={colors.primaryBlue}
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* Driver Details Dropdown */}
            {expanded && (status === 'accepted' || status === 'in_progress') && (
                <View style={styles.dropdown}>
                    <View style={styles.divider} />

                    <View style={styles.driverInfo}>
                        <View style={styles.infoRow}>
                            <Ionicons name="person" size={18} color={colors.primaryBlue} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Driver</Text>
                                <Text style={styles.infoValue}>{driverName || 'N/A'}</Text>
                            </View>
                        </View>

                        {driverPhone && (
                            <TouchableOpacity onPress={callDriver} style={styles.infoRow} activeOpacity={0.7}>
                                <Ionicons name="call" size={18} color={colors.primaryBlue} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Phone — tap to call</Text>
                                    <Text style={[styles.infoValue, styles.infoValueCallable]}>{driverPhone}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.primaryBlue} />
                            </TouchableOpacity>
                        )}

                        {vehicleId && (
                            <View style={styles.infoRow}>
                                <Ionicons name="car-sport" size={18} color={colors.primaryBlue} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Vehicle</Text>
                                    <Text style={styles.infoValue}>{vehicleId}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: sp(70), // Below header
        left: sp(16),
        right: sp(16),
        backgroundColor: 'white',
        borderRadius: br(12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 1000,
        overflow: 'hidden',
    },
    mainBar: {
        padding: sp(14),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: sp(10),
    },
    statusText: {
        fontSize: fs(14),
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    actions: {
        marginLeft: sp(12),
    },
    cancelButton: {
        paddingHorizontal: sp(14),
        paddingVertical: sp(8),
        backgroundColor: '#fee',
        borderRadius: br(8),
    },
    cancellingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(6),
    },
    cancelText: {
        color: '#d32f2f',
        fontWeight: '600',
        fontSize: fs(13),
    },
    driverActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(8),
    },
    callButton: {
        backgroundColor: '#4caf50',
        borderRadius: br(8),
        padding: sp(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: sp(12),
        paddingVertical: sp(8),
        backgroundColor: colors.secondary,
        borderRadius: br(8),
        gap: sp(4),
    },
    viewText: {
        color: colors.primaryBlue,
        fontWeight: '600',
        fontSize: fs(13),
    },
    infoValueCallable: {
        color: colors.primaryBlue,
        textDecorationLine: 'underline',
    },
    dropdown: {
        paddingHorizontal: sp(14),
        paddingBottom: sp(14),
    },
    divider: {
        height: 1,
        backgroundColor: colors.lightGrey2,
        marginBottom: sp(12),
    },
    driverInfo: {
        gap: sp(12),
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(12),
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: fs(11),
        color: colors.lightGrey3,
        marginBottom: sp(2),
    },
    infoValue: {
        fontSize: fs(14),
        fontWeight: '600',
        color: '#333',
    },
});

export default RideStatusBar;
