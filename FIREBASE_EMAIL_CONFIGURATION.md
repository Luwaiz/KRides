# Firebase Email Configuration Guide

## Issues to Fix

1. **Emails going to spam folder**
2. **Links not clickable in email client**
3. **Domain not allowlisted error** (auth/unauthorized-continue-uri)

---

## ⚠️ IMPORTANT: Fix Domain Not Allowlisted Error

If you're getting `auth/unauthorized-continue-uri` error, you need to allowlist your domain:

### Quick Fix:
1. Go to Firebase Console → Authentication → Settings
2. Scroll to **Authorized domains** section
3. Click **Add domain**
4. Add these domains:
   - `localhost` (for local testing)
   - Your actual domain (e.g., `kampusrides.com`)
   - Any redirect URLs you want to use
5. Click **Add**

**Note:** The app currently works WITHOUT custom redirect URLs to avoid this error. You only need to add domains if you want to customize the redirect behavior.

---

## 🔧 Solution 1: Configure Custom Email Templates (RECOMMENDED)

### Step 1: Access Firebase Console

1. Go to https://console.firebase.google.com
2. Select your KRides project
3. Click on **Authentication** in left sidebar
4. Click on **Templates** tab at the top

### Step 2: Customize Password Reset Email

1. Find **Password reset** in the template list
2. Click the **pencil icon** to edit
3. Update the template with better formatting:

```
Subject: Reset Your Kampus Rides Password

Body:
Hello,

We received a request to reset your Kampus Rides password.

Click the button below to reset your password:
%LINK%

If you didn't request this, you can safely ignore this email.

This link will expire in 1 hour for security reasons.

Best regards,
The Kampus Rides Team

---
If the button doesn't work, copy and paste this link into your browser:
%LINK%
```

4. Click **Save**

### Step 3: Customize Sender Details

1. In the same Templates section
2. Look for **Customize sender** or **SMTP settings**
3. Configure:
   - **From name**: `Kampus Rides` (instead of default)
   - **Reply-to email**: `support@kampusrides.com` (if you have one)

---

## 🎯 Solution 2: Set Up Custom Domain (BEST - Prevents Spam)

### Why Custom Domain?

- Emails from `noreply@kampusrides.com` look more professional
- Much less likely to be marked as spam
- Builds trust with users

### Requirements:

1. Own a domain (e.g., kampusrides.com)
2. Firebase Blaze plan (pay-as-you-go)
3. Access to domain DNS settings

### Steps:

#### A. Upgrade to Firebase Blaze Plan

1. Go to Firebase Console → Settings (gear icon)
2. Click **Usage and billing**
3. Click **Modify plan**
4. Select **Blaze (pay as you go)**
5. Add payment method

#### B. Set Up Custom Email Domain

1. Go to **Authentication → Templates**
2. Click **Customize domain**
3. Follow Firebase instructions to:
   - Add DNS records to your domain
   - Verify domain ownership
   - Wait for DNS propagation (24-48 hours)

#### C. Configure Email Service

Firebase uses SendGrid or similar services. To improve deliverability:

1. Set up SPF records in your DNS
2. Set up DKIM records
3. Set up DMARC policy

**Example DNS Records:**

```
Type    Name                Value
TXT     @                   v=spf1 include:_spf.google.com ~all
TXT     default._domainkey  [DKIM key from Firebase/SendGrid]
TXT     _dmarc              v=DMARC1; p=none; rua=mailto:dmarc@kampusrides.com
```

---

## 🔍 Solution 3: Fix Non-Clickable Links

### Issue

Some email clients (especially mobile) don't recognize Firebase links as clickable URLs.

### Fixes Applied in Code:

✅ Added `actionCodeSettings` to `sendPasswordResetEmail()`
✅ Configured redirect URL
✅ Updated toast message to mention spam folder

### Additional Email Client Fixes:

#### For Gmail Users:

1. After receiving first email, click "Not spam"
2. Add `noreply@[your-project].firebaseapp.com` to contacts
3. Future emails will go to inbox

#### For Outlook/Hotmail Users:

1. Right-click email → Mark as "Not junk"
2. Add sender to safe senders list:
   - Settings → Mail → Junk email
   - Add Firebase sender to safe senders

#### For iOS Mail App:

1. Tap and hold the link
2. Select "Open in Safari"
3. Or enable "Load Remote Images" in Mail settings

---

## 🛠️ Solution 4: Test Email Deliverability

### Use Email Testing Tools:

1. **Mail Tester** (https://www.mail-tester.com)

   - Send reset email to address@mail-tester.com
   - Get spam score and recommendations

2. **GlockApps** (https://glockapps.com)

   - Test inbox placement across providers

3. **SendForensics** (https://sendforensics.com)
   - Analyze email authentication

---

## 📱 Solution 5: In-App Password Reset (Advanced)

Instead of email links, handle password reset entirely in-app:

### Benefits:

- No spam issues
- No broken links
- Better UX

### Implementation:

1. Send verification code (6-digit) via Firebase email
2. User enters code in app
3. User sets new password in app
4. Update password using Firebase API

**Note:** This requires custom backend or Firebase Functions.

---

## ✅ Quick Checklist

**Immediate Actions (No cost):**

- [ ] Customize email template in Firebase Console
- [ ] Update sender name to "Kampus Rides"
- [ ] Test with different email providers (Gmail, Outlook, Yahoo)
- [ ] Ask users to mark as "Not spam" initially
- [ ] Update toast message to mention checking spam folder ✅ (Already done)

**Short-term (Within 1-2 weeks):**

- [ ] Upgrade to Firebase Blaze plan if needed
- [ ] Purchase/use existing domain
- [ ] Set up custom email domain
- [ ] Configure SPF, DKIM, DMARC records

**Long-term (Optional):**

- [ ] Implement in-app password reset with codes
- [ ] Set up custom email service (SendGrid, AWS SES)
- [ ] Monitor email deliverability metrics

---

## 🎓 Best Practices

1. **Tell users to check spam folder** ✅

   - Updated in toast message
   - Consider adding to UI text

2. **Use professional sender name**

   - Not: "noreply@project-id.firebaseapp.com"
   - Yes: "Kampus Rides <support@kampusrides.com>"

3. **Keep email content clean**

   - Avoid spam trigger words (FREE, URGENT, CLICK NOW)
   - Use proper HTML structure
   - Include unsubscribe link (for marketing emails)

4. **Test regularly**

   - Test on Gmail, Outlook, Yahoo, Apple Mail
   - Test on mobile and desktop
   - Check spam scores monthly

5. **Warm up domain**
   - Start with low email volume
   - Gradually increase over weeks
   - Monitor bounce and complaint rates

---

## 📞 Support

If emails continue going to spam after following these steps:

1. Check Firebase Console → Authentication → Usage for any errors
2. Contact Firebase Support (if on Blaze plan)
3. Review email deliverability reports
4. Consider using a dedicated email service (SendGrid, Mailgun, AWS SES)

---

## 🔗 Useful Links

- [Firebase Email Customization](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Action Codes](https://firebase.google.com/docs/auth/web/email-link-auth)
- [SPF Record Setup](https://www.spf-record.com/)
- [DKIM Setup Guide](https://www.dkim.org/)
- [Email Deliverability Best Practices](https://sendgrid.com/blog/email-deliverability-best-practices/)

---

**Last Updated:** November 15, 2025
**Version:** 1.0
