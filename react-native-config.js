import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import  { FontAwesome } from "@expo/vector-icons";


export default function FontResources() {
	const [fontLoaded, setFontLoaded] = useState(false);

	useEffect(() => {
		async function LoadFonts() {
			try {
				SplashScreen.preventAutoHideAsync();
				await Font.loadAsync({
					...FontAwesome.font,
					'Albert-Bold': require("./assets/fonts/AlbertSans-VariableFont_wght.ttf"),
					'Albert-ExtraBold': require("./assets/fonts/AlbertSans-ExtraBold.ttf"),
					'Albert-Light': require("./assets/fonts/AlbertSans-Light.ttf"),
					'Albert-Medium': require("./assets/fonts/AlbertSans-Medium.ttf"),
					'Albert-Regular': require("./assets/fonts/AlbertSans-Regular.ttf"),
					'Albert-SemiBold': require("./assets/fonts/AlbertSans-SemiBold.ttf"),
					'Albert-Thin': require("./assets/fonts/AlbertSans-Thin.ttf"),
                    "Poppins": require("./assets/fonts/Poppins-Medium.ttf")
				});
			} catch (error) {
				console.warn(error);
			} finally {
				setFontLoaded(true);
				SplashScreen.hideAsync();
			}
		}
		LoadFonts();
	}, []);
	return fontLoaded;
}
