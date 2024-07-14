import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import Navigation from "./navigation/Navigation";
import { SafeAreaProvider } from "react-native-safe-area-context";
import FontResources from "./react-native-config";
import { PaperProvider } from "react-native-paper";
import Toast from "react-native-toast-message";
import ToastConfig from "./components/ToastConfig";

export default function App() {
	const fontLoaded = FontResources();
	if (!fontLoaded) {
		return null;
	} else {
		return (
			<GestureHandlerRootView style={styles.container}>
				<SafeAreaProvider>
					<PaperProvider>
						<Navigation />
						<StatusBar style="auto" />
						<Toast config={ToastConfig}/>
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
