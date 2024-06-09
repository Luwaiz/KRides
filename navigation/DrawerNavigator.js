import { View, Text } from 'react-native'
import React from 'react'
import { createDrawerNavigator } from '@react-navigation/drawer'
import MainPage from '../screens/AppScreens/MainPage'
import AppStack from './AppStack'

const Drawer = createDrawerNavigator()
const DrawerNavigator = () => {
  return (
    <Drawer.Navigator screenOptions={{headerShown:false}}>
        <Drawer.Screen component={AppStack} name='Main'/>
    </Drawer.Navigator>
  )
}

export default DrawerNavigator