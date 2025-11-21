import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import { StyleSheet, Text, View, Alert } from "react-native";
import Navigation from "./navigation/Navigation";
import BaseUrlBanner from "./components/BaseUrlBanner";
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
		
		// Only show user-friendly alert for FATAL/CRITICAL errors
		// Let components handle their own Firebase/Network errors
		const errorMessage = args.join(' ');
		if (errorMessage.includes('FATAL') || errorMessage.includes('CRITICAL')) {
			Alert.alert(
				'Critical Error',
				'A critical error occurred. Please restart the app or contact support.',
				[{ text: 'OK' }]
			);
		}
		// Other errors (Firebase, Network) are logged but not alerted
		// This allows components to show specific error messages
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
