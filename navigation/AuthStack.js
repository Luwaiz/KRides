import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import AuthScreen from '../screens/AuthScreen'
import Login from '../screens/Login'
import Signup from '../screens/Signup'

const Stack = createNativeStackNavigator()

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown:false}}>
        <Stack.Screen component={AuthScreen} name='AuthScreen'/>
        <Stack.Screen component={Login} name='Login'/>
        <Stack.Screen component={Signup} name='Signup'/>
    </Stack.Navigator>
  )
}

export default AuthStack

const styles = StyleSheet.create({})