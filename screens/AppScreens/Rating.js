import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import TextInput1 from '../../components/TextInput1'
import ActiveButton from '../../components/buttons/ActiveButton'

const Rating = () => {
  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.topCont}>
        <BackButton
            text={<Text style={styles.headText}>Your ride has ended!</Text>}
        />
    </View>
    <View style={styles.infoCont}>
        <Text style={styles.infoText}>Let's know you better!</Text>
    </View>
    <View style={styles.bottomCont}>
        <TextInput1 text={"First Name"} placeholder={"e.g John"} />
        <TextInput1 text={"Last Name"} placeholder={"e.g Dotun"} />
        <View style={styles.button}>
            <ActiveButton title={"Submit Rating"} />
        </View>
    </View>
</SafeAreaView>
  )
}

export default Rating

const styles = StyleSheet.create({
    container: {
		flex: 1,
		backgroundColor: colors.secondary2,
	},
	topCont: {
		paddingTop: 26,
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontWeight: "700",
	},
	infoCont: {
		marginVertical: 16,
		paddingHorizontal: 16,
		gap: 4,
		justifyContent: "center",
	},
	infoText: {
		color: colors.lightGrey3,
		fontSize: 16,
	},
	bottomCont: {
		flex: 1,
		paddingHorizontal: 16,
	},
	button: {
		marginTop: "auto",
		marginBottom: 16,
	},
})