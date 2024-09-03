import { View, Text } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomePage from "../screens/DriverScreens.js/HomePage";
import Support from "../screens/AppScreens/Support";
import About from "../screens/AppScreens/About";
import History from "../screens/AppScreens/History";
import ProfilePage from "../screens/AppScreens/ProfilePage";
import AcceptTab from "../components/DriversModal/AcceptTab";

const Stack = createNativeStackNavigator();

const DriverStack = () => {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen component={HomePage} name="DriverHome" />
			<Stack.Screen name="Support" component={Support} />
			<Stack.Screen name="About" component={About} />
			<Stack.Screen name="History" component={History} />
			<Stack.Screen name="Profile" component={ProfilePage} />
			<Stack.Screen name="Destinations" component={AcceptTab} />
		</Stack.Navigator>
	);
};

export default DriverStack;
