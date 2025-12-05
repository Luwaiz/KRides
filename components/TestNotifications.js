import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Test Notification Component
 * Add this to any screen to test if notifications are working
 * 
 * Usage:
 * import TestNotifications from './components/TestNotifications';
 * <TestNotifications />
 */

export default function TestNotifications() {
    const [permissionStatus, setPermissionStatus] = useState('unknown');
    const [lastNotification, setLastNotification] = useState(null);

    useEffect(() => {
        // Check permission status
        checkPermissions();

        // Listen for notifications
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            console.log('📬 Notification received:', notification);
            setLastNotification(notification);
            Alert.alert(
                'Notification Received!',
                `${notification.request.content.title}\n${notification.request.content.body}`
            );
        });

        return () => subscription.remove();
    }, []);

    const checkPermissions = async () => {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
        console.log('📱 Notification permission status:', status);
    };

    const requestPermissions = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);
        console.log('📱 Permission request result:', status);

        if (status === 'granted') {
            Alert.alert('Success', 'Notification permissions granted!');
        } else {
            Alert.alert('Denied', 'Notification permissions were denied');
        }
    };

    const sendTestNotification = async () => {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Test Notification 🔔",
                    body: 'This is a test notification from KRides!',
                    data: { test: true },
                    sound: true,
                },
                trigger: { seconds: 2 },
            });
            Alert.alert('Scheduled', 'Test notification will appear in 2 seconds');
        } catch (error) {
            console.error('Error scheduling notification:', error);
            Alert.alert('Error', error.message);
        }
    };

    const sendImmediateNotification = async () => {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Immediate Test 🔔",
                    body: 'This should appear immediately!',
                    data: { test: true },
                    sound: true,
                },
                trigger: null, // null trigger = immediate
            });
            Alert.alert('Sent', 'Immediate notification sent');
        } catch (error) {
            console.error('Error sending immediate notification:', error);
            Alert.alert('Error', error.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notification Test Panel</Text>

            <View style={styles.statusContainer}>
                <Text style={styles.label}>Permission Status:</Text>
                <Text style={[
                    styles.status,
                    { color: permissionStatus === 'granted' ? 'green' : 'red' }
                ]}>
                    {permissionStatus.toUpperCase()}
                </Text>
            </View>

            {permissionStatus !== 'granted' && (
                <Button
                    title="Request Permissions"
                    onPress={requestPermissions}
                    color="#4CAF50"
                />
            )}

            <View style={styles.buttonContainer}>
                <Button
                    title="Send Test (2s delay)"
                    onPress={sendTestNotification}
                    disabled={permissionStatus !== 'granted'}
                />
            </View>

            <View style={styles.buttonContainer}>
                <Button
                    title="Send Immediate"
                    onPress={sendImmediateNotification}
                    disabled={permissionStatus !== 'granted'}
                />
            </View>

            {lastNotification && (
                <View style={styles.lastNotification}>
                    <Text style={styles.label}>Last Notification:</Text>
                    <Text>{lastNotification.request.content.title}</Text>
                    <Text style={styles.small}>{lastNotification.request.content.body}</Text>
                </View>
            )}

            <View style={styles.instructions}>
                <Text style={styles.instructionTitle}>Instructions:</Text>
                <Text style={styles.instructionText}>
                    1. Make sure permissions are granted{'\n'}
                    2. Put app in background{'\n'}
                    3. Click "Send Test" button{'\n'}
                    4. Wait 2 seconds{'\n'}
                    5. Notification should appear
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        margin: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        justifyContent: 'center',
    },
    label: {
        fontWeight: 'bold',
        marginRight: 10,
    },
    status: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonContainer: {
        marginVertical: 5,
    },
    lastNotification: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#e8f5e9',
        borderRadius: 5,
    },
    small: {
        fontSize: 12,
        color: '#666',
        marginTop: 5,
    },
    instructions: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#fff3cd',
        borderRadius: 5,
    },
    instructionTitle: {
        fontWeight: 'bold',
        marginBottom: 10,
    },
    instructionText: {
        fontSize: 12,
        lineHeight: 18,
    },
});
