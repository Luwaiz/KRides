import { View, Text } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomePage from "../screens/DriverScreens/HomePage";
import Support from "../screens/AppScreens/Support";
import About from "../screens/AppScreens/About";
import History from "../screens/AppScreens/History";
// Driver-specific profile
import DriverProfilePage from "../screens/DriverScreens/DriverProfilePage";
import AcceptTab from "../components/DriversModal/AcceptTab";
import DriverSettings from "../screens/DriverScreens/DriverSetting";

const Stack = createNativeStackNavigator();

const DriverStack = () => {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen component={HomePage} name="DriverHome" />
			<Stack.Screen name="Support" component={Support} />
			<Stack.Screen name="About" component={About} />
			<Stack.Screen name="History" component={History} />
			<Stack.Screen name="Profile" component={DriverProfilePage} />
			<Stack.Screen name="Destinations" component={AcceptTab} />
			<Stack.Screen component={DriverSettings} name="DriverSettings" />
		</Stack.Navigator>
	);
};

export default DriverStack;
