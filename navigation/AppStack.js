import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainPage from "../screens/AppScreens/MainPage";
import PickDestination from "../screens/AppScreens/Route";
import About from "../screens/AppScreens/About";
import Support from "../screens/AppScreens/Support";
import History from "../screens/AppScreens/History";
import ProfilePage from "../screens/AppScreens/ProfilePage";
import Passenger from "../components/Passenger";
import Promo from "../screens/AppScreens/Promo";
import HomePageNav from "./HomePageNav";
import Settings from "../screens/AppScreens/Settings";
import Wallet from "../screens/AppScreens/Wallet";

const Stack = createNativeStackNavigator();
const AppStack = () => {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen name="Home" component={MainPage} />
			<Stack.Screen name="Wallet" component={Wallet} />
			<Stack.Screen
				name="Settings"
				component={Settings}
				options={{ animation: "slide_from_left" }}
			/>
			<Stack.Screen name="Support" component={Support} />
			<Stack.Screen name="About" component={About} />
			<Stack.Screen name="History" component={History} />
			<Stack.Screen name="Profile" component={ProfilePage} />
			<Stack.Screen name="Destinations" component={PickDestination} />
			<Stack.Screen name="Passenger" component={Passenger} />
			<Stack.Screen name="Promo" component={Promo} />
		</Stack.Navigator>
	);
};

export default AppStack;
