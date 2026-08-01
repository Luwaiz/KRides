import { useState, useEffect } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

/**
 * Custom hook for Google Sign-In
 * Handles the complete Google authentication flow
 */
export function useGoogleAuth() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Configure Google Sign-In on mount
    useEffect(() => {
        GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
        });
        console.log('✅ Google Sign-In configured');
    }, []);

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

            console.log('📦 Google Sign-In response received');

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

            // Store intended role BEFORE Firebase sign-in so Navigation.js
            // reads it when onAuthStateChanged fires (before Firestore doc exists)
            await AsyncStorage.setItem('pending_role', role);

            // Sign in to Firebase with Google credential
            console.log('🔥 Signing in to Firebase...');
            const userCredential = await signInWithCredential(FIREBASE_AUTH, googleCredential);
            console.log('✅ Firebase sign-in successful:', userCredential.user.uid);

            // Register for push notifications and save token - REMOVED


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
            } else if (err.code === 'auth/account-exists-with-different-credential') {
                errorMessage = 'An account already exists with this email using a different sign-in method. Please log in with your email and password instead.';
            } else if (err.code === 'auth/wrong-role-account') {
                errorMessage = err.message;
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
