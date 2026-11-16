import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../constants/styling";

// Any other TextInput prop (keyboardType, autoCapitalize, maxLength, textContentType,
// autoComplete...) is passed straight through. The screens have always supplied these, but
// they used to be dropped here, so email fields capitalised and autocorrected, phone and
// account-number fields showed the full keyboard, and maxLength was never applied.
const TextInput1 = ({ text, placeholder, password, onChangeText, value, editable, ...inputProps }) => {
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

	// Passwords are never capitalised or autocorrected.
	const passwordProps = password
		? { autoCapitalize: "none", autoCorrect: false, spellCheck: false }
		: null;

	return (
		<View style={styles.container}>
			<Text style={styles.text}>{text}</Text>
			<View style={[styles.inputCont,focus && styles.focus]} focusable>
				<TextInput
					{...passwordProps}
					{...inputProps}
                    secureTextEntry={!!password && !passwordVisible}
					placeholder={placeholder}
					placeholderTextColor={colors.lightGrey}
					onFocus={()=>toggleFocus()}
					onBlur={()=>toggleBlur()}
					cursorColor={"black"}
					onChangeText={onChangeText}
					style={styles.input}
					value={value}
					editable={editable}
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
        justifyContent:"space-between",
		borderWidth: 1,
		borderColor: "transparent",
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
