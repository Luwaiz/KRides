import { useState, useEffect } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

export function useGoogleAuth() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
        });
        console.log('✅ Google Sign-In configured');
    }, []);

    const signInWithGoogle = async (role = 'customer') => {
        setLoading(true);
        setError(null);

        try {
            await GoogleSignin.hasPlayServices({
                showPlayServicesUpdateDialog: true,
            });

            console.log('🔐 Starting Google Sign-In...');

            try {
                await GoogleSignin.signOut();
            } catch (e) {
            }

            const userInfo = await GoogleSignin.signIn();

            console.log('📦 Google Sign-In response received');

            const googleUser = userInfo.user || userInfo.data?.user || userInfo;
            const email = googleUser?.email || userInfo.data?.email;

            console.log('✅ Google Sign-In successful:', email || 'No email');

            const idToken = userInfo.idToken || userInfo.data?.idToken;
            if (!idToken) {
                console.error('❌ No ID token in response:', userInfo);
                throw new Error('No ID token received from Google');
            }

            const googleCredential = GoogleAuthProvider.credential(idToken);

            await AsyncStorage.setItem('pending_role', role);

            console.log('🔥 Signing in to Firebase...');
            const userCredential = await signInWithCredential(FIREBASE_AUTH, googleCredential);
            console.log('✅ Firebase sign-in successful:', userCredential.user.uid);



            const needsPhone = role === 'driver' && !googleUser?.phoneNumber;

            return {
                user: userCredential.user,
                googleUser: googleUser,
                needsPhone,
            };
        } catch (err) {
            console.error('❌ Google Sign-In Error:', err);
            setError(err);

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

    const signOutFromGoogle = async () => {
        try {
            await GoogleSignin.signOut();
            console.log('✅ Signed out from Google');
        } catch (err) {
            console.error('❌ Google Sign-Out Error:', err);
        }
    };

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
