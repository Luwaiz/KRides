import {
	ActivityIndicator,
	Keyboard,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/styling";
import Feather from "@expo/vector-icons/Feather";
import Entypo from "@expo/vector-icons/Entypo";

const EditableInput = ({
	text,
	loading,
	password,
	onChangeText,
	value,
	editable,
	Edit,
}) => {
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [focus, setFocus] = useState(false);
	const [placeholderColor, setPlaceholderColor] = useState("green");

	useEffect(() => {
		if (editable === false) {
			setFocus(false);
		}
	}, [editable]);
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
			<View style={[styles.inputCont, focus && styles.focus]} focusable>
				{editable ? (
					<>
						<TextInput
							secureTextEntry={password && !passwordVisible}
							placeholder={value}
							placeholderTextColor={colors?.lightGrey}
							onFocus={() => toggleFocus()}
							onBlur={() => toggleBlur()}
							cursorColor={"black"}
							onChangeText={onChangeText}
							style={styles.input}
						/>
						{password &&
							(passwordVisible ? (
								<TouchableOpacity onPress={() => togglePasswordVisibility()}>
									<Ionicons
										name="eye"
										size={24}
										color={colors.lightGrey}
										style={{ marginRight: 16 }}
									/>
								</TouchableOpacity>
							) : (
								<TouchableOpacity onPress={() => togglePasswordVisibility()}>
									<Ionicons
										name="eye-off"
										size={24}
										color={colors.lightGrey}
										style={{ marginRight: 16 }}
									/>
								</TouchableOpacity>
							))}
					</>
				) : (
					<>
						<View>
							<Text style={styles.staticText}>{value}</Text>
						</View>
						{password &&
							(passwordVisible ? (
								<TouchableOpacity onPress={() => togglePasswordVisibility()}>
									<Ionicons
										name="eye"
										size={24}
										color={colors.lightGrey}
										style={{ marginRight: 16 }}
									/>
								</TouchableOpacity>
							) : (
								<TouchableOpacity onPress={() => togglePasswordVisibility()}>
									<Ionicons
										name="eye-off"
										size={24}
										color={colors.lightGrey}
										style={{ marginRight: 16 }}
									/>
								</TouchableOpacity>
							))}
					</>
				)}
				<TouchableOpacity onPress={() => Edit()}>
					{editable ? (
						loading ? (
							<ActivityIndicator color={colors.primaryBlue} />
						) : (
							<Entypo name="check" size={24} color="black" />
						)
					) : (
						<Feather name="edit" size={24} color="black" />
					)}
				</TouchableOpacity>
			</View>
		</View>
	);
};

export default EditableInput;

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
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
	},
	input: {
		width: "90%",
		height: "100%",
		fontSize: 16,
	},
	text: {
		fontSize: 16,
	},
	focus: {
		borderColor: colors.primaryBlue,
		borderWidth: 1,
	},
	staticText: {
		color: colors.primaryBlue,
		fontSize: 16,
	},
});
