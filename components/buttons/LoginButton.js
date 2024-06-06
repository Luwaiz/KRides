import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { colors } from '../../constants/styling'

const LoginButton = ({title,onPress}) => {
  return (
    <TouchableOpacity onPress={onPress}>
    <View style={styles.button}>
        <Text style={styles.buttonText}>{title}</Text>
    </View>
</TouchableOpacity>
  )
}

export default LoginButton

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.secondary,
        minWidth: 167,
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth:1,
        borderColor:colors.primaryBlue,
        marginTop:14
    },
    buttonText: {
        color: colors.primaryBlue,
        fontSize: 16,
        fontWeight: "500",
    },
})