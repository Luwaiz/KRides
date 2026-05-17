import { View, Text } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomePage from "../screens/DriverScreens/HomePage";
import Support from "../screens/AppScreens/Support";
import About from "../screens/AppScreens/About";
import History from "../screens/AppScreens/History";
// Driver-specific profile
import DriverProfilePage from "../screens/DriverScreens/DriverProfilePage";
import DriverReviews from "../screens/DriverScreens/DriverReviews";
import DriverEarnings from "../screens/DriverScreens/DriverEarnings";
import AcceptTab from "../components/DriversModal/AcceptTab";
import DriverSettings from "../screens/DriverScreens/DriverSetting";
import BankAccountDetails from "../screens/AuthScreens/BankAccountDetails";
import { useDriverDetails } from "../constants/Store";

const Stack = createNativeStackNavigator();

const DriverStack = () => {
	const bankDetailsVerified = useDriverDetails((state) => state.bankDetailsVerified);
	const bankDetailsSkipped = useDriverDetails((state) => state.bankDetailsSkipped);

	return (
		<Stack.Navigator
			screenOptions={{ headerShown: false }}
			initialRouteName={(bankDetailsVerified || bankDetailsSkipped) ? "DriverHome" : "BankAccountDetails"}
		>
			<Stack.Screen component={HomePage} name="DriverHome" />
			<Stack.Screen name="Support" component={Support} />
			<Stack.Screen name="About" component={About} />
			<Stack.Screen name="History" component={History} />
			<Stack.Screen name="Profile" component={DriverProfilePage} />
			<Stack.Screen name="DriverEarnings" component={DriverEarnings} />
			<Stack.Screen name="DriverReviews" component={DriverReviews} />
			<Stack.Screen name="Destinations" component={AcceptTab} />
			<Stack.Screen component={DriverSettings} name="DriverSettings" />
			<Stack.Screen component={BankAccountDetails} name="BankAccountDetails" />
		</Stack.Navigator>
	);
};

export default DriverStack;
