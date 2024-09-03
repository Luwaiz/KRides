import { StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import OnBoarding from "../screens/OnBoarding";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthStack from "./AuthStack";
import DrawerNavigator from "./DrawerNavigator";
import DriverStack from "./DriverStack";
import DriverDrawer from "./DriverDrawer";

const Stack = createNativeStackNavigator();
const Navigation = () => {
	const [firstLaunch, setFirstLaunch] = useState(null);
	const appLaunch = async () => {
		try {
			const value = await AsyncStorage.getItem("firstLaunch");
			if (value !== null) {
				setFirstLaunch(true);
				AsyncStorage.setItem("firstLaunch", "false");
			} else {
				setFirstLaunch(false);
			}
		} catch (e) {
			console.log(e);
		}
	};
	useEffect(() => {
		appLaunch();
	}, []);
	return (
		firstLaunch !== null && (
			<NavigationContainer>
				<Stack.Navigator screenOptions={{ headerShown: false }}>
					<Stack.Screen component={OnBoarding} name="OnBoarding" />
					<Stack.Screen component={AuthStack} name="AuthStack" />
					<Stack.Screen component={DrawerNavigator} name="drawer" />
					<Stack.Screen component={DriverDrawer} name="DriverDrawer" />
				</Stack.Navigator>
			</NavigationContainer>
		)
	);
};

export default Navigation;

