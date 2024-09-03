import { View, Text } from 'react-native'
import React from 'react'
import { createDrawerNavigator } from '@react-navigation/drawer'
import MainPage from '../screens/AppScreens/MainPage'
import AppStack from './AppStack'
import DrawerComponent from '../components/DrawerComponent'
import DriverStack from './DriverStack'

const Drawer = createDrawerNavigator()
const DrawerNavigator = () => {
  return (
    <Drawer.Navigator drawerContent={(props)=><DrawerComponent {...props}/>} screenOptions={{headerShown:false}}>
        <Drawer.Screen component={AppStack} name='Main'/>
        <Drawer.Screen name='Driver' component={DriverStack} />
    </Drawer.Navigator>
  )
}

export default DrawerNavigator