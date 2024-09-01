import { View, Text } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomePage from "../screens/DriverScreens.js/HomePage";

const Stack = createNativeStackNavigator();

const DriverStack = () => {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen component={HomePage} name="DriverHome" />
		</Stack.Navigator>
	);
};

export default DriverStack;
