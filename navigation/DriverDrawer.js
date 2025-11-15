import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
// use the driver-specific drawer component we added
import DriverStack from "./DriverStack";
import DriverDrawerComponent from "../components/DriverDrawerComponent";

const Drawer = createDrawerNavigator();

const DriverDrawer = () => {
	return (
		<Drawer.Navigator
			drawerContent={(props) => <DriverDrawerComponent {...props} />}
			screenOptions={{ headerShown: false }}
		>
			<Drawer.Screen name="Driver" component={DriverStack} />
		</Drawer.Navigator>
	);
};

export default DriverDrawer;
