import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'

const Test = (navigation) => {
  return (
    <View style={styles.container}>
      <Text>Test</Text>
      <TouchableOpacity >
        <Text>Touch Me</Text>
      </TouchableOpacity>
    </View>
  )
}

export default Test

const styles = StyleSheet.create({
    container:{
        flex:0.5,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'red'
    }
})