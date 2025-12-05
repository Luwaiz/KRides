import { ScrollView, StyleSheet, Text, View, Linking, Pressable } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/styling';
import BackButton from '../../components/buttons/BackButton';

const Support = () => {
  const handleEmailPress = () => {
    Linking.openURL('mailto:kampusrides24@gmail.com');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton text={<Text style={styles.headerTitle}>Support</Text>} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Students Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students</Text>
          <Text style={styles.text}>
            KRIDES support is here to ensure your campus rides are smooth and stress-free. You can:
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bulletPoint}>• Access the FAQ for answers to common questions</Text>
            <Text style={styles.bulletPoint}>• Report ride issues or driver concerns directly in the app</Text>
            <Text style={styles.bulletPoint}>• Use the in-app chat to get instant help</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Drivers Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drivers Support</Text>
          <Text style={styles.text}>
            KRIDES support is available to help you earn safely and manage your rides efficiently. You can:
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bulletPoint}>• Access the FAQ for answers to common driver questions</Text>
            <Text style={styles.bulletPoint}>• Report trip problems, cancellations, or student disputes</Text>
            <Text style={styles.bulletPoint}>• Use the in-app chat for quick assistance</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Contact Us Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.text}>
            For additional support or inquiries, you can reach us at:
          </Text>
          <Pressable onPress={handleEmailPress}>
            <Text style={styles.emailText}>kampusrides24@gmail.com</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FAQ</Text>

          {/* Students FAQ */}
          <Text style={styles.subSectionTitle}>Students FAQ</Text>

          <View style={styles.faqItem}>
            <Text style={styles.question}>1. How do I book a ride?</Text>
            <Text style={styles.answer}>
              Open KRIDES, select your destination, choose the number of passengers, and confirm your ride.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>2. How do I pay for my ride?</Text>
            <Text style={styles.answer}>
              All payments are processed securely through Flutterwave within the app.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>3. Can I book for my friends?</Text>
            <Text style={styles.answer}>
              Yes, you can select multiple passengers during booking.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>4. What happens if a driver doesn't show up?</Text>
            <Text style={styles.answer}>
              Report the issue using the in-app chat. Our support team will assist you immediately.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>5. How much is a ride?</Text>
            <Text style={styles.answer}>
              Each ride costs ₦200 per passenger plus a ₦50 KRIDES service fee.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Drivers FAQ */}
          <Text style={styles.subSectionTitle}>Drivers FAQ</Text>

          <View style={styles.faqItem}>
            <Text style={styles.question}>1. How do I accept rides?</Text>
            <Text style={styles.answer}>
              Open the KRIDES driver app and tap "Accept Ride" when a request pops up.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>2. How do I get paid?</Text>
            <Text style={styles.answer}>
              All payments are processed securely through Flutterwave.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>3. Can I see how many passengers I'll carry?</Text>
            <Text style={styles.answer}>
              Yes, each trip request shows the number of passengers and total fare.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>4. What if a student cancels?</Text>
            <Text style={styles.answer}>
              Report the cancellation through the app; KRIDES support will handle the case.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>5. Are my earnings safe?</Text>
            <Text style={styles.answer}>
              Yes, KRIDES ensures secure, fair, and reliable payments for all drivers.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Support;

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
    fontFamily: 'Albert-Bold',
    fontWeight: 'bold',
    color: colors.primaryBlue,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 20,
    fontFamily: 'Albert-SemiBold',
    fontWeight: '600',
    color: colors.primaryBlue,
    marginTop: 16,
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: colors.lightGrey4,
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: 'Albert-Regular',
  },
  emailText: {
    fontSize: 17,
    fontFamily: 'Albert-SemiBold',
    fontWeight: '600',
    color: colors.primaryBlue,
    marginTop: 4,
    textDecorationLine: 'underline',
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
  faqItem: {
    marginBottom: 16,
  },
  question: {
    fontSize: 16,
    fontFamily: 'Albert-SemiBold',
    fontWeight: '600',
    color: colors.primaryBlue,
    marginBottom: 6,
  },
  answer: {
    fontSize: 15,
    color: colors.lightGrey4,
    lineHeight: 22,
    fontFamily: 'Albert-Regular',
    paddingLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGrey2,
    marginVertical: 24,
  },
});