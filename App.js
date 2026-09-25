import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import { StyleSheet, Text, View, Alert } from "react-native";
import Navigation from "./navigation/Navigation";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import FontResources from "./react-native-config";
import { PaperProvider } from "react-native-paper";
import Toast from "react-native-toast-message";
import ToastConfig from "./components/ToastConfig";
import ErrorBoundary from "./components/ErrorBoundary";
import NetworkBanner from "./components/NetworkBanner";
import UpdateBanner from "./components/UpdateBanner";
import { installGlobalErrorHandlers } from "./helpers/globalErrorHandler";
import { startPricingConfigListener } from "./constants/pricingConfig";

installGlobalErrorHandlers();
startPricingConfigListener();

import {
	configureReanimatedLogger,
	ReanimatedLogLevel,
} from "react-native-reanimated";
import React from "react";

enableScreens();

if (!__DEV__) {
	const originalConsoleError = console.error;
	console.error = (...args) => {
		originalConsoleError(...args);

		const errorMessage = args.join(' ');

		if (errorMessage.includes('FATAL') &&
			!errorMessage.includes('Firebase: Error (auth/user-not-found)') &&
			!errorMessage.includes('Firestore: Error (permission-denied)')) {
			Toast.show({
				type: 'tomatoToast',
				text1: 'System Error',
				text2: 'A critical error occurred. Please restart the app or contact support.',
				position: 'top',
				visibilityTime: 5000,
			});
		}
	};
}


configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false,
});
function AppToast() {
	const insets = useSafeAreaInsets();
	return <Toast config={ToastConfig} topOffset={insets.top + 12} />;
}

function App() {
	const fontLoaded = FontResources();

	if (!fontLoaded) {
		return null;
	} else {
		return (
			<ErrorBoundary>
				<GestureHandlerRootView style={styles.container}>
					<SafeAreaProvider>
						<PaperProvider>
							<Navigation />
							<NetworkBanner />
							<UpdateBanner />
							<StatusBar style="auto" />
							<AppToast />
						</PaperProvider>
					</SafeAreaProvider>
				</GestureHandlerRootView>
			</ErrorBoundary>
		);
	}
}

export default App;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
