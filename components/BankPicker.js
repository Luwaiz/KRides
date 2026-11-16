import React, { useMemo, useState } from "react";
import {
	FlatList,
	Modal,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/styling";
import { maxContentWidth } from "../constants/responsive";

// A field that opens a searchable list of banks. Replaces the native picker, whose iOS
// wheel can't fit (or be scrolled) inside a single-line field.
const BankPicker = ({ banks, value, onChange, disabled }) => {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const selected = banks.find((b) => b.value === value);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return q ? banks.filter((b) => b.label.toLowerCase().includes(q)) : banks;
	}, [banks, search]);

	const close = () => {
		setOpen(false);
		setSearch("");
	};

	return (
		<>
			<Text style={styles.label}>Bank</Text>
			<TouchableOpacity
				style={styles.field}
				onPress={() => setOpen(true)}
				disabled={disabled}
				activeOpacity={0.7}
			>
				<Text style={selected ? styles.fieldText : styles.placeholder} numberOfLines={1}>
					{selected ? selected.label : "Choose your bank"}
				</Text>
				<Ionicons name="chevron-down" size={20} color={colors.lightGrey3} />
			</TouchableOpacity>

			<Modal visible={open} animationType="slide" onRequestClose={close}>
				{/* A Modal is its own native window on iOS, so it needs its own provider. */}
				<SafeAreaProvider>
					<SafeAreaView style={styles.modal}>
						<View style={styles.inner}>
							<View style={styles.header}>
								<Text style={styles.title}>Select Bank</Text>
								<TouchableOpacity onPress={close} hitSlop={12}>
									<Ionicons name="close" size={26} color="black" />
								</TouchableOpacity>
							</View>

							<View style={styles.search}>
								<Ionicons name="search" size={18} color={colors.lightGrey3} />
								<TextInput
									style={styles.searchInput}
									placeholder="Search banks"
									value={search}
									onChangeText={setSearch}
									autoCorrect={false}
									autoCapitalize="none"
									clearButtonMode="while-editing"
								/>
							</View>

							<FlatList
								data={filtered}
								keyExtractor={(item) => item.value}
								keyboardShouldPersistTaps="handled"
								renderItem={({ item }) => (
									<TouchableOpacity
										style={styles.row}
										onPress={() => {
											onChange(item.value);
											close();
										}}
									>
										<Text style={styles.rowText}>{item.label}</Text>
										{item.value === value && (
											<Ionicons name="checkmark" size={20} color={colors.primaryBlue} />
										)}
									</TouchableOpacity>
								)}
								ListEmptyComponent={
									<Text style={styles.empty}>No bank matches "{search}"</Text>
								}
							/>
						</View>
					</SafeAreaView>
				</SafeAreaProvider>
			</Modal>
		</>
	);
};

export default BankPicker;

const styles = StyleSheet.create({
	label: {
		fontSize: 16,
	},
	field: {
		width: "100%",
		height: 48,
		backgroundColor: colors.lightGrey2,
		borderRadius: 8,
		marginTop: 8,
		marginBottom: 16,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	fieldText: {
		flex: 1,
		fontSize: 16,
		color: "#222",
	},
	placeholder: {
		flex: 1,
		fontSize: 16,
		color: colors.lightGrey3,
	},
	modal: {
		flex: 1,
		backgroundColor: "#fff",
	},
	inner: {
		flex: 1,
		width: "100%",
		maxWidth: maxContentWidth,
		alignSelf: "center",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	title: {
		fontSize: 18,
		fontFamily: "Albert-SemiBold",
	},
	search: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.lightGrey2,
		borderRadius: 10,
		marginHorizontal: 16,
		marginBottom: 8,
		paddingHorizontal: 12,
		height: 44,
	},
	searchInput: {
		flex: 1,
		marginLeft: 8,
		fontSize: 16,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.lightGrey2,
	},
	rowText: {
		flex: 1,
		fontSize: 16,
	},
	empty: {
		textAlign: "center",
		marginTop: 40,
		color: colors.lightGrey3,
	},
});
