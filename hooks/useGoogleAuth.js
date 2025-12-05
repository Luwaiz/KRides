import { useState } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebaseConfig';

/**
 * Custom hook for Google Sign-In
 * Handles the complete Google authentication flow
 */
export function useGoogleAuth() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Sign in with Google
     * @param {string} role - 'customer' or 'driver'
     * @returns {Promise<{user, needsPhone}>} Firebase user and whether phone is needed
     */
    const signInWithGoogle = async (role = 'customer') => {
        setLoading(true);
        setError(null);

        try {
            // Check if Google Play Services are available
            await GoogleSignin.hasPlayServices({
                showPlayServicesUpdateDialog: true,
            });

            // Sign in with Google
            console.log('🔐 Starting Google Sign-In...');

            // Force sign out first to allow account switching
            try {
                await GoogleSignin.signOut();
            } catch (e) {
                // Ignore error if not signed in
            }

            const userInfo = await GoogleSignin.signIn();

            // Log the full response to debug
            console.log('📦 Google Sign-In response:', JSON.stringify(userInfo, null, 2));

            // Extract user data - handle different response structures
            const googleUser = userInfo.user || userInfo.data?.user || userInfo;
            const email = googleUser?.email || userInfo.data?.email;

            console.log('✅ Google Sign-In successful:', email || 'No email');

            // Get Google ID token
            const idToken = userInfo.idToken || userInfo.data?.idToken;
            if (!idToken) {
                console.error('❌ No ID token in response:', userInfo);
                throw new Error('No ID token received from Google');
            }

            // Create Firebase credential
            const googleCredential = GoogleAuthProvider.credential(idToken);

            // Sign in to Firebase with Google credential
            console.log('🔥 Signing in to Firebase...');
            const userCredential = await signInWithCredential(FIREBASE_AUTH, googleCredential);
            console.log('✅ Firebase sign-in successful:', userCredential.user.uid);

            // Register for push notifications and save token
            try {
                const { registerForPushNotificationsAsync } = require('../helpers/notifications');
                const { doc, setDoc } = require('firebase/firestore');
                const { FIREBASE_DB } = require('../firebaseConfig');

                const pushToken = await registerForPushNotificationsAsync();

                if (pushToken) {
                    // Use setDoc with merge: true so it creates the doc if it doesn't exist
                    await setDoc(doc(FIREBASE_DB, 'users', userCredential.user.uid), {
                        pushToken: pushToken,
                        pushTokenUpdatedAt: new Date(),
                    }, { merge: true });
                    console.log('✅ Push token saved:', pushToken);
                } else {
                    console.log('⚠️ No push token received - notifications may not work');
                }
            } catch (tokenError) {
                console.error('⚠️ Failed to register push token:', tokenError.message);
                // Don't fail the sign-in if push token registration fails
            }

            // Check if phone number is needed (for drivers)
            const needsPhone = role === 'driver' && !googleUser?.phoneNumber;

            return {
                user: userCredential.user,
                googleUser: googleUser,
                needsPhone,
            };
        } catch (err) {
            console.error('❌ Google Sign-In Error:', err);
            setError(err);

            // Handle specific error codes
            let errorMessage = 'Google Sign-In failed. Please try again.';

            if (err.code === statusCodes.SIGN_IN_CANCELLED) {
                errorMessage = 'Sign-in was cancelled';
            } else if (err.code === statusCodes.IN_PROGRESS) {
                errorMessage = 'Sign-in is already in progress';
            } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                errorMessage = 'Google Play Services not available';
            }

            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Sign out from Google
     */
    const signOutFromGoogle = async () => {
        try {
            await GoogleSignin.signOut();
            console.log('✅ Signed out from Google');
        } catch (err) {
            console.error('❌ Google Sign-Out Error:', err);
        }
    };

    /**
     * Check if user is already signed in with Google
     */
    const checkGoogleSignIn = async () => {
        try {
            const isSignedIn = await GoogleSignin.isSignedIn();
            if (isSignedIn) {
                const userInfo = await GoogleSignin.getCurrentUser();
                return userInfo;
            }
            return null;
        } catch (err) {
            console.error('❌ Check Google Sign-In Error:', err);
            return null;
        }
    };

    return {
        signInWithGoogle,
        signOutFromGoogle,
        checkGoogleSignIn,
        loading,
        error,
    };
}
