import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BankAccountDetails from "../screens/AuthScreens/BankAccountDetails";
import DriverHome from "../screens/DriverScreens/HomePage"; // Need this for the "Skip" navigation target

const Stack = createNativeStackNavigator();

const DriverOnboardingStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="BankAccountDetails" component={BankAccountDetails} />
            {/* We include DriverHome here so that if they skip, they can navigate to it. 
                However, Navigation.js will switch the whole stack once verified/skipped. 
                Actually, if they skip, we might just want to update the state to verified=true (or skipped=true) 
                and let Navigation.js handle the switch. 
                But for now, let's just keep BankAccountDetails here. 
                Wait, if BankAccountDetails navigates to "DriverHome", that screen needs to be in this stack 
                OR we need to handle the state change so Navigation.js unmounts this stack and mounts DriverDrawer.
                
                The plan says: "If you are a driver but NOT verified, show the DriverOnboardingStack".
                So when they click "Skip" or "Save", we should update the local state/store/firestore 
                so that `bankDetailsVerified` becomes true.
                
                In BankAccountDetails.js, we are navigating to "DriverHome". 
                If "DriverHome" is not in this stack, it will fail.
                
                Strategy:
                The "Skip" or "Save" action should update the user's profile in Firestore (or at least local state) 
                to set `bankDetailsVerified: true`. 
                Once that happens, `Navigation.js` will see the new prop and switch stacks.
                
                So `DriverOnboardingStack` only needs `BankAccountDetails`.
            */}
        </Stack.Navigator>
    );
};

export default DriverOnboardingStack;
