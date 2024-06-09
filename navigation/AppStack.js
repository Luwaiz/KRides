import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MainPage from '../screens/AppScreens/MainPage'
import PickDestination from '../screens/AppScreens/Route'

const Stack = createNativeStackNavigator()
const AppStack = () => {
  return (

    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="Home" component={MainPage} />
      <Stack.Screen name="Destinations" component={PickDestination} />
    </Stack.Navigator>
  )
}

export default AppStack

const styles = StyleSheet.create({})