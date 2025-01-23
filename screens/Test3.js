import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

const Test3 = () => {
  return (
    <View style={styles.container}>
      <Text>Test</Text>
    </View>
  )
}

export default Test3

const styles = StyleSheet.create({
    container:{
        flex:0.5,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'green'
    }
})