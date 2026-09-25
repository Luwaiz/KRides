import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BankAccountDetails from "../screens/AuthScreens/BankAccountDetails";
import DriverHome from "../screens/DriverScreens/HomePage";

const Stack = createNativeStackNavigator();

const DriverOnboardingStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="BankAccountDetails" component={BankAccountDetails} />
            {}
        </Stack.Navigator>
    );
};

export default DriverOnboardingStack;
