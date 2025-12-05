// Basic Jest setup for React Native testing

// Mock react-native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase
jest.mock('./firebaseConfig', () => ({
    FIREBASE_AUTH: {
        currentUser: { uid: 'test-uid', email: 'test@example.com' },
    },
    FIREBASE_DB: {},
    FIREBASE_STORAGE: {},
}));

// Mock firebase/auth
jest.mock('firebase/auth', () => ({
    GoogleAuthProvider: {
        credential: jest.fn(() => ({ providerId: 'google.com' })),
    },
    signInWithCredential: jest.fn(() => Promise.resolve({
        user: { uid: 'test-uid', email: 'test@example.com' }
    })),
}));

// Mock Google Sign-In
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(() => Promise.resolve(true)),
        signIn: jest.fn(() => Promise.resolve({
            user: { email: 'test@gmail.com' },
            idToken: 'mock-id-token'
        })),
        signOut: jest.fn(() => Promise.resolve()),
        isSignedIn: jest.fn(() => Promise.resolve(false)),
        getCurrentUser: jest.fn(() => Promise.resolve(null)),
    },
    statusCodes: {
        SIGN_IN_CANCELLED: '12501',
        IN_PROGRESS: '12502',
        PLAY_SERVICES_NOT_AVAILABLE: '12500',
    },
}));

// Silence console warnings in tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};
