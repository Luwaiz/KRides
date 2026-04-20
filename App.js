import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import { StyleSheet, Text, View, Alert } from "react-native";
import Navigation from "./navigation/Navigation";
import { SafeAreaProvider } from "react-native-safe-area-context";
import FontResources from "./react-native-config";
import { PaperProvider } from "react-native-paper";
import Toast from "react-native-toast-message";
import ToastConfig from "./components/ToastConfig";
import ErrorBoundary from "./components/ErrorBoundary";

import {
	configureReanimatedLogger,
	ReanimatedLogLevel,
} from "react-native-reanimated";
import React from "react";

enableScreens();

// Global error handler for production
if (!__DEV__) {
	const originalConsoleError = console.error;
	console.error = (...args) => {
		// Log to console
		originalConsoleError(...args);

		// Show user-friendly alert for critical errors only
		const errorMessage = args.join(' ');

		// Only show alert for truly fatal crashes or errors we explicitly mark as FATAL
		// Avoid showing for common background Firebase/Network warnings that are often non-fatal
		if (errorMessage.includes('FATAL') &&
			!errorMessage.includes('Firebase: Error (auth/user-not-found)') &&
			!errorMessage.includes('Firestore: Error (permission-denied)')) {
			Alert.alert(
				'System Error',
				'A critical error occurred. Please restart the app or contact support.',
				[{ text: 'OK' }]
			);
		}
	};
}


// This is the default configuration
configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false, // Reanimated runs in strict mode by default
});
export default function App() {
	const fontLoaded = FontResources();

	// Removed Firebase notification setup - not supported in React Native with Web SDK

	if (!fontLoaded) {
		return null;
	} else {
		return (
			<ErrorBoundary>
				<GestureHandlerRootView style={styles.container}>
					<SafeAreaProvider>
						<PaperProvider>
							<Navigation />
							<StatusBar style="auto" />
							<Toast config={ToastConfig} />
						</PaperProvider>
					</SafeAreaProvider>
				</GestureHandlerRootView>
			</ErrorBoundary>
		);
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
