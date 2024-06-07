import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { colors } from "../constants/styling";

const TextInput1 = ({ text, placeholder, password,onChangeText}) => {
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [focus, setFocus] = useState(false);
	const toggleFocus = () => {
        setFocus(true);
    };
	const toggleBlur = () => {
		setFocus(false);
    };
    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };
    // text input component

	return (
		<View style={styles.container}>
			<Text style={styles.text}>{text}</Text>
			<View style={[styles.inputCont,focus && styles.focus]} focusable>
				<TextInput
                    secureTextEntry={password && !passwordVisible}
					placeholder={placeholder}
					placeholderTextColor={colors.lightGrey}
					onFocus={()=>toggleFocus()}
					onBlur={()=>toggleBlur()}
					cursorColor={"black"}
					onChangeText={onChangeText}
					style={styles.input}
				/>
				{password &&
					(passwordVisible ? (
                        <TouchableOpacity onPress={()=>togglePasswordVisibility()}>
						<Ionicons name="eye" size={24} color={colors.lightGrey}  style={{marginRight:16}}/>
                        </TouchableOpacity>
					) : (
                        <TouchableOpacity onPress={()=>togglePasswordVisibility()}>
                        <Ionicons name="eye-off" size={24} color={colors.lightGrey} style={{marginRight:16}}/>
                        </TouchableOpacity>))}
			</View>
		</View>
	);
};

export default TextInput1;

const styles = StyleSheet.create({
	container: {
		marginBottom: 16,
	},
	inputCont: {
		width: "100%",
		height: 48,
		backgroundColor: colors.lightGrey2,
		borderRadius: 8,
		marginTop: 8,
        flexDirection:"row",
        alignItems: "center",
        justifyContent:"space-between"
	},
	input: {
		width: "90%",
		height: "100%",
		paddingHorizontal: 16,
		fontSize: 16,
	},
	text:{
		fontSize: 16,
	},
	focus:{
		borderColor:colors.primaryBlue,
		borderWidth:1,
	}
});
