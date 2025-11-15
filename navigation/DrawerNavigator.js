import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import AppStack from "./AppStack";
import DrawerComponent from "../components/DrawerComponent";
import DriverStack from "./DriverStack";

const Drawer = createDrawerNavigator();
const DrawerNavigator = () => {
	return (
		<Drawer.Navigator
			drawerContent={(props) => <DrawerComponent {...props} />}
			screenOptions={{ headerShown: false }}
		>
			<Drawer.Screen component={AppStack} name="Main" />
		</Drawer.Navigator>
	);
};

export default DrawerNavigator;
