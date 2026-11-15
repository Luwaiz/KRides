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
import CompletePhoneNumber from "../screens/AuthScreens/CompletePhoneNumber";
import useAuthStore from "../constants/Store";

const Stack = createNativeStackNavigator();
const AppStack = () => {
	const hasPhone = useAuthStore((state) => !!state.profile?.phone);

	// Screens are defined conditionally rather than picked with initialRouteName: this stack
	// mounts before the profile has loaded, and initialRouteName is only read once, so it
	// would stay on the phone screen. This way it swaps to Home once the profile has a phone.
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			{hasPhone ? (
				<>
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
				</>
			) : (
				<Stack.Screen name="CompletePhoneNumber" component={CompletePhoneNumber} />
			)}
		</Stack.Navigator>
	);
};

export default AppStack;
