import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainPage from "../screens/AppScreens/MainPage";
import React from "react";

const Stack = createNativeStackNavigator();
const HomePageNav = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={MainPage} />
    </Stack.Navigator>
  );
};

export default HomePageNav;