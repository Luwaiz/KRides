const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD,
        },
    });
    return transporter;
}

/**
 * Email the admin about a new driver report.
 * Fails open — the report is already saved to Firestore by the caller before
 * this runs, so a missing/broken email config should never fail the report
 * submission itself. Returns { sent: false, reason } instead of throwing.
 */
async function sendDriverReportEmail(report) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const t = getTransporter();
    if (!t || !adminEmail) {
        console.log('📧 Email not configured (GMAIL_USER/GMAIL_APP_PASSWORD/ADMIN_EMAIL) — skipping driver report email');
        return { sent: false, reason: 'not_configured' };
    }

    const html = `
        <h2>New Driver Report</h2>
        <p><strong>Reason:</strong> ${report.reason}</p>
        <p><strong>Description:</strong> ${report.description || 'None provided'}</p>
        <hr>
        <h3>Driver</h3>
        <p>${report.driverName} — ${report.driverPhone} — ${report.driverEmail}</p>
        <p>Vehicle ID: ${report.driverVehicleId}</p>
        <h3>Customer</h3>
        <p>${report.customerName} — ${report.customerPhone}</p>
        <h3>Ride</h3>
        <p>${report.pickupLocation} → ${report.destination}</p>
        <p>Amount: ₦${report.rideAmount} — Status: ${report.rideStatus}</p>
        <p>Ride ID: ${report.rideId}</p>
    `;

    try {
        await t.sendMail({
            from: `"KRides Reports" <${process.env.GMAIL_USER}>`,
            to: adminEmail,
            subject: `Driver Report: ${report.driverName} (${report.reason})`,
            html,
        });
        console.log('✅ Driver report email sent to admin');
        return { sent: true };
    } catch (error) {
        console.error('❌ Failed to send driver report email:', error.message);
        return { sent: false, reason: 'send_failed', error: error.message };
    }
}

module.exports = { sendDriverReportEmail };
