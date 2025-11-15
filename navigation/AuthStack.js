import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthScreen from "../screens/AuthScreens/AuthScreen";
import Login from "../screens/AuthScreens/Login";
import Signup from "../screens/AuthScreens/Signup";
import DriverSignup from "../screens/AuthScreens/DriverSignUp";
import DriverLogin from "../screens/AuthScreens/DriverLogin";
import ForgetPass from "../screens/AuthScreens/ForgetPass";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen component={AuthScreen} name="AuthScreen" />
			<Stack.Screen component={Login} name="Login" />
			<Stack.Screen component={Signup} name="Signup" />
			<Stack.Screen component={DriverSignup} name="DriverSignup" />
			<Stack.Screen component={DriverLogin} name="DriverLogin" />
			<Stack.Screen component={ForgetPass} name="ForgetPass" />
		</Stack.Navigator>
	);
};

export default AuthStack;

const styles = StyleSheet.create({});
