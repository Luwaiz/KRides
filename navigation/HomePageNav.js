import { StyleSheet, Text, View, TextInput } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, useRoute } from "@react-navigation/native";

// Screens
import Test from "../screens/Test";
import Test2 from "../screens/Test2";
import Test3 from "../screens/Test3";

const Stack = createNativeStackNavigator();

// Custom Header Component
const CustomHeader = ({ routeName }) => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>
        {routeName === "Test"
          ? "Test Page Header"
          : routeName === "Test2"
          ? "Second Page Header"
          : routeName === "Test3"
          ? "Third Page Header"
          : "Default Header"}
      </Text>
      <TextInput style={styles.searchBar} placeholder="Search here..." />
    </View>
  );
};

// Shared Layout Component
const LayoutWithMap = ({ children }) => {
  const route = useRoute(); // Get the current route to dynamically update the header

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <CustomHeader routeName={route.name} />

      {/* Map Background */}
      <View style={styles.map}>
        <Text>Map View Placeholder</Text>
        {/* Replace this Text with your <MapView /> */}
      </View>

      {/* Screen Content */}
      <View style={styles.screenContent}>{children}</View>
    </View>
  );
};

// HomePageNav Component
const HomePageNav = () => {
  return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // Disable React Navigation's default header
        }}
      >
        {/* Screen 1 */}
        <Stack.Screen
          name="Test"
          component={(props) => (
            <LayoutWithMap>
              <Test {...props} />
            </LayoutWithMap>
          )}
        />
        {/* Screen 2 */}
        <Stack.Screen
          name="Test2"
          component={(props) => (
            <LayoutWithMap>
              <Test2 {...props} />
            </LayoutWithMap>
          )}
        />
        {/* Screen 3 */}
        <Stack.Screen
          name="Test3"
          component={(props) => (
            <LayoutWithMap>
              <Test3 {...props} />
            </LayoutWithMap>
          )}
        />
      </Stack.Navigator>
  );
};

export default HomePageNav;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f1f1",
  },
  header: {
    height: 60,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  searchBar: {
    flex: 1,
    height: 40,
    marginLeft: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#f1f1f1",
  },
  map: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0", // Placeholder for map background
  },
  screenContent: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
