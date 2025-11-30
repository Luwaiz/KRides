import { ScrollView, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/styling';
import BackButton from '../../components/buttons/BackButton';

const About = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton text={<Text style={styles.headerTitle}>About KRIDES</Text>} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drivers</Text>
          <Text style={styles.text}>
            KRIDES is a platform designed to help drivers earn safely and efficiently on campus. With KRIDES, drivers can:
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bulletPoint}>• Accept ride requests from students easily</Text>
            <Text style={styles.bulletPoint}>• Receive secure payments through the app</Text>
            <Text style={styles.bulletPoint}>• Manage rides and passengers effectively</Text>
          </View>
          <Text style={styles.text}>
            KRIDES ensures fair earnings, consistent trips, and a trusted system that protects drivers while providing top service to students. Our mission is to make campus driving reliable and profitable, so you can focus on earning safely.
          </Text>
          <Text style={styles.tagline}>KRIDES: Your rides, your earnings, simplified.</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students</Text>
          <Text style={styles.text}>
            KRIDES is a campus mobility app designed to make moving around campus easier, safer, and more convenient. With KRIDES, students can:
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bulletPoint}>• Book rides quickly and conveniently on campus</Text>
            <Text style={styles.bulletPoint}>• Pay securely through the app</Text>
            <Text style={styles.bulletPoint}>• Book rides for themselves or with friends</Text>
          </View>
          <Text style={styles.text}>
            KRIDES focuses on making campus transportation stress-free, reliable, and accessible for all students. Our mission is to make campus travel simple and hassle-free, so you can focus on your studies and activities.
          </Text>
          <Text style={styles.tagline}>KRIDES: Your campus ride, simplified.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default About;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryBlue,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Albert-SemiBold',
    color: colors.secondary,
    marginLeft: 10,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 10,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Albert-Bold', // Assuming this font exists based on other files, or fallback to fontWeight
    fontWeight: 'bold',
    color: colors.primaryBlue,
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: colors.lightGrey4,
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: 'Albert-Regular', // Assuming
  },
  bulletPoints: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: colors.lightGrey4,
    lineHeight: 24,
    marginBottom: 6,
    fontFamily: 'Albert-Regular',
  },
  tagline: {
    fontSize: 18,
    fontFamily: 'Albert-SemiBold',
    fontWeight: '600',
    color: colors.primaryBlue,
    marginTop: 8,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGrey2,
    marginVertical: 24,
  },
});