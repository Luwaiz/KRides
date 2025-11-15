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

import {
	configureReanimatedLogger,
	ReanimatedLogLevel,
} from "react-native-reanimated";
import React from "react";

enableScreens();
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
			<GestureHandlerRootView style={styles.container}>
				<SafeAreaProvider>
					<PaperProvider>
						<Navigation />
						<StatusBar style="auto" />
						<Toast config={ToastConfig} />
					</PaperProvider>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		);
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
