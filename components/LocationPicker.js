import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TextInput,
	FlatList,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	Modal,
	Alert
} from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/styling";
import { FIREBASE_DB } from "../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

const LocationPicker = ({
	visible,
	onClose,
	onSelectLocation,
	title = "Select Location",
	showPopularOnly = false,
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [locations, setLocations] = useState([]);
	const [filteredLocations, setFilteredLocations] = useState([]);
	const [loading, setLoading] = useState(true);
	const [popularLocations, setPopularLocations] = useState([]);

	useEffect(() => {
		if (visible) {
			fetchLocations();
		}
	}, [visible]);

	useEffect(() => {
		filterLocations();
	}, [searchQuery, locations]);

	const fetchLocations = async () => {
		try {
			setLoading(true);
			const locationsRef = collection(FIREBASE_DB, "locations");

			let q = query(locationsRef, where("active", "==", true));
			if (showPopularOnly) {
				q = query(
					locationsRef,
					where("popular", "==", true),
					where("active", "==", true)
				);
			}

			const snapshot = await getDocs(q);
			const locationsData = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			// Sort by name
			locationsData.sort((a, b) => a.name.localeCompare(b.name));

			setLocations(locationsData);
			setPopularLocations(locationsData.filter((loc) => loc.popular));
			setFilteredLocations(locationsData);
			setLoading(false);
		} catch (error) {
			console.error("Error fetching locations:", error);
			setLoading(false);

			// Show specific error message to user
			if (error.code === 'permission-denied') {
				Alert.alert(
					'Permission Error',
					'Unable to load locations due to database permissions. Please contact support.',
					[{ text: 'OK', onPress: onClose }]
				);
			} else if (error.message?.includes('network') || error.message?.includes('fetch')) {
				Alert.alert(
					'Connection Error',
					'Unable to load locations. Please check your internet connection and try again.',
					[{ text: 'Retry', onPress: fetchLocations }, { text: 'Cancel', onPress: onClose }]
				);
			} else {
				Alert.alert(
					'Error',
					'Unable to load locations. Please try again.',
					[
						{ text: 'Cancel', style: 'cancel', onPress: onClose },
						{ text: 'Retry', onPress: fetchLocations },
					]
				);
			}
		}
	};

	const filterLocations = () => {
		if (!searchQuery.trim()) {
			setFilteredLocations(locations);
			return;
		}

		const query = searchQuery.toLowerCase().trim();
		const filtered = locations.filter((location) => {
			// Search in name
			if (location.name.toLowerCase().includes(query)) {
				return true;
			}
			// Search in address
			if (location.address?.toLowerCase().includes(query)) {
				return true;
			}
			// Search in category
			if (location.category?.toLowerCase().includes(query)) {
				return true;
			}
			// Search in keywords
			if (location.searchKeywords?.some((keyword) => keyword.includes(query))) {
				return true;
			}
			return false;
		});

		setFilteredLocations(filtered);
	};

	const handleSelectLocation = (location) => {
		onSelectLocation({
			name: location.name,
			latitude: location.coordinates.latitude,
			longitude: location.coordinates.longitude,
			address: location.address,
			id: location.id,
		});
		setSearchQuery("");
		onClose();
	};

	const renderLocationItem = ({ item }) => (
		<TouchableOpacity
			style={styles.locationItem}
			onPress={() => handleSelectLocation(item)}
		>
			<View style={styles.locationIcon}>
				<Ionicons
					name={getIconName(item.type)}
					size={24}
					color={colors.primaryBlue}
				/>
			</View>
			<View style={styles.locationInfo}>
				<Text style={styles.locationName}>{item.name}</Text>
				<Text style={styles.locationAddress}>{item.address}</Text>
				{item.popular && (
					<View style={styles.popularBadge}>
						<AntDesign name="star" size={12} color="#FFA500" />
						<Text style={styles.popularText}>Popular</Text>
					</View>
				)}
			</View>
			<AntDesign name="right" size={20} color={colors.lightGrey} />
		</TouchableOpacity>
	);

	const getIconName = (type) => {
		const iconMap = {
			landmark: "location",
			building: "business",
			residential: "home",
			food: "restaurant",
			recreation: "football",
			market: "cart",
			transport: "bus",
		};
		return iconMap[type] || "location";
	};

	const renderEmptyState = () => (
		<View style={styles.emptyState}>
			<Ionicons name="search-outline" size={64} color={colors.lightGrey} />
			<Text style={styles.emptyText}>No locations found</Text>
			<Text style={styles.emptySubtext}>Try a different search term</Text>
		</View>
	);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={false}
			onRequestClose={onClose}
		>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity onPress={onClose} style={styles.backButton}>
						<AntDesign name="arrowleft" size={24} color="black" />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>{title}</Text>
					<View style={{ width: 24 }} />
				</View>

				{/* Search Bar */}
				<View style={styles.searchContainer}>
					<Ionicons name="search" size={20} color={colors.lightGrey} />
					<TextInput
						style={styles.searchInput}
						placeholder="Search locations..."
						value={searchQuery}
						onChangeText={setSearchQuery}
						autoCapitalize="none"
						autoCorrect={false}
					/>
					{searchQuery.length > 0 && (
						<TouchableOpacity onPress={() => setSearchQuery("")}>
							<Ionicons
								name="close-circle"
								size={20}
								color={colors.lightGrey}
							/>
						</TouchableOpacity>
					)}
				</View>

				{/* Popular Locations (shown when no search) */}
				{!searchQuery && popularLocations.length > 0 && (
					<View style={styles.popularSection}>
						<Text style={styles.sectionTitle}>Popular Locations</Text>
					</View>
				)}

				{/* Locations List */}
				{loading ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color={colors.primaryBlue} />
						<Text style={styles.loadingText}>Loading locations...</Text>
					</View>
				) : (
					<FlatList
						data={
							searchQuery
								? filteredLocations
								: popularLocations.length > 0
									? popularLocations
									: filteredLocations
						}
						renderItem={renderLocationItem}
						keyExtractor={(item) => item.id}
						contentContainerStyle={styles.listContainer}
						ListEmptyComponent={renderEmptyState}
						showsVerticalScrollIndicator={false}
					/>
				)}
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey2,
		// paddingTop: 50,
	},
	backButton: {
		padding: 4,
	},
	headerTitle: {
		fontSize: 18,
		fontFamily: "Albert-SemiBold",
		color: "black",
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.lightGrey2,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		margin: 16,
	},
	searchInput: {
		flex: 1,
		marginLeft: 8,
		fontSize: 16,
		fontFamily: "Albert-Regular",
	},
	popularSection: {
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	sectionTitle: {
		fontSize: 14,
		fontFamily: "Albert-SemiBold",
		color: colors.textGrey,
		textTransform: "uppercase",
	},
	listContainer: {
		paddingHorizontal: 16,
		paddingBottom: 20,
	},
	locationItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey2,
	},
	locationIcon: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.lightGrey2,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 12,
	},
	locationInfo: {
		flex: 1,
	},
	locationName: {
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
		color: "black",
		marginBottom: 4,
	},
	locationAddress: {
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: colors.textGrey,
	},
	popularBadge: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 4,
	},
	popularText: {
		fontSize: 12,
		fontFamily: "Albert-Regular",
		color: "#FFA500",
		marginLeft: 4,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		fontFamily: "Albert-Regular",
		color: colors.textGrey,
	},
	emptyState: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 60,
	},
	emptyText: {
		fontSize: 18,
		fontFamily: "Albert-SemiBold",
		color: "black",
		marginTop: 16,
	},
	emptySubtext: {
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: colors.textGrey,
		marginTop: 8,
	},
});

export default LocationPicker;
