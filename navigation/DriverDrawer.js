import React from 'react'
import { createDrawerNavigator } from '@react-navigation/drawer'
import DrawerComponent from '../components/DrawerComponent'
import DriverStack from './DriverStack'

const Drawer = createDrawerNavigator()
const DriverDrawer = () => {
  return (
    <Drawer.Navigator drawerContent={(props)=><DrawerComponent {...props}/>} screenOptions={{headerShown:false}}>
        <Drawer.Screen name='Driver' component={DriverStack} />
    </Drawer.Navigator> 
  )
}

export default DriverDrawer