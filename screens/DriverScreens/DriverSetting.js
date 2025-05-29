import { Pressable, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { useUserDetails } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Foundation from "@expo/vector-icons/Foundation";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import Confirmation1 from "../../components/modals/Confirmation1";

const DriverSettings = ({ navigation }) => {
    const [modal, setModal] = useState(false);
    const { firstName, lastName } = useUserDetails((state) => ({
        firstName: state.firstName,
        lastName: state.lastName,
    }));
    const [modalTitle, setModalTitle] = useState("");

    const openModal = (title) => {
        setModalTitle(title);
        setModal(true);
    };
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topContainer}>
                <Text style={styles.name}>{firstName + " " + lastName}</Text>
                <Avatar height={80} width={80} />
            </View>
            <View style={styles.middleContainer}>
                <Pressable
                    style={styles.iconContainer}
                    onPress={() => navigation.navigate("History")}
                >
                    <MaterialCommunityIcons
                        name="car-clock"
                        size={35}
                        color={colors.primaryBlue}
                    />
                    <Text style={styles.iconText}>Ride history</Text>
                </Pressable>
                <Pressable style={styles.iconContainer}>
                    <Entypo name="wallet" size={35} color={colors.primaryBlue} />
                    <Text style={styles.iconText}>Wallet</Text>
                </Pressable>
                <Pressable
                    style={styles.iconContainer}
                    onPress={() => navigation.navigate("About")}
                >
                    <Foundation name="info" size={35} color={colors.primaryBlue} />
                    <Text style={styles.iconText}>About</Text>
                </Pressable>
            </View>
            <View style={styles.bottomContainer}>
                <Pressable
                    style={styles.options}
                    onPress={() => navigation.navigate("Profile")}
                >
                    <Ionicons name="settings" size={20} color="black" />
                    <Text style={styles.optionText}>Edit Profile</Text>
                </Pressable>
                <Pressable style={styles.options}>
                    <MaterialIcons name="support-agent" size={20} color="black" />
                    <Text style={styles.optionText}>Support</Text>
                </Pressable>
                <Pressable style={styles.options} onPress={() => openModal("Logout")}>
                    <MaterialCommunityIcons name="logout" size={24} color="black" />
                    <Text style={styles.optionText}>Logout</Text>
                </Pressable>
                <Pressable
                    style={styles.options}
                    onPress={() => openModal("Delete Account")}
                >
                    <MaterialIcons name="delete-forever" size={24} color="black" />
                    <Text style={styles.optionText}>Delete Account</Text>
                </Pressable>
            </View>
            {modal && (
                <Confirmation1 modal={modal} setModal={setModal} title={modalTitle} />
            )}
        </SafeAreaView>
    );
};

export default DriverSettings;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",

        padding: 16,
    },
    topContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 50,
    },
    name: {
        fontSize: 35,
        // fontWeight:"bold",
        fontFamily: "Albert-SemiBold",
        maxWidth: "70%",
    },
    middleContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    iconContainer: {
        width: 100,
        height: 95,
        borderRadius: 7,
        backgroundColor: colors.lightGrey2,
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
    },
    iconText: {
        fontSize: 15,
        fontFamily: "Albert-Medium",
    },
    bottomContainer: {
        marginTop: 50,
    },
    options: {
        flexDirection: "row",
        gap: 10,
        marginVertical: 16,
    },
    optionText: {
        fontSize: 16,
        fontFamily: "Albert-Medium",
    },
});
