import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MainPage from '../screens/AppScreens/MainPage'

const Stack = createNativeStackNavigator()
const AppStack = () => {
  return (

    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="Home" component={MainPage} />
    </Stack.Navigator>
  )
}

export default AppStack

const styles = StyleSheet.create({})