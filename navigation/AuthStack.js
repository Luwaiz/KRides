import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthScreen from "../screens/AuthScreens/AuthScreen";
import Login from "../screens/AuthScreens/Login";
import Signup from "../screens/AuthScreens/Signup";
import VerifyNo from "../screens/AuthScreens/VerifyNo";
import Name from "../screens/AuthScreens/Name";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen component={AuthScreen} name="AuthScreen" />
			<Stack.Screen component={Login} name="Login" />
			<Stack.Screen component={Signup} name="Signup" />
			<Stack.Screen component={VerifyNo} name="VerifyNo" />
			<Stack.Screen component={Name} name="Name" />
		</Stack.Navigator>
	);
};

export default AuthStack;

const styles = StyleSheet.create({});
