const nodemailer = require('nodemailer');

const ADMIN_NOTIFICATION_EMAIL = 'vs0158213@gmail.com';

// Configure transporter dynamically
function getTransporter() {
    // Force mock transporter in automated test environment
    if (process.env.NODE_ENV === 'test') {
        return {
            transporter: {
                sendMail: async (mailOptions) => ({ messageId: 'test-mock-' + Date.now() })
            },
            senderEmail: ADMIN_NOTIFICATION_EMAIL
        };
    }

    const pass = process.env.App_password || process.env.APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const user = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER || ADMIN_NOTIFICATION_EMAIL;

    if (pass) {
        // Strip quotes and spaces from 16-character Google App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
        const cleanPass = pass.replace(/["'\s]/g, '').trim();
        const cleanUser = user.trim();
        return {
            transporter: nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: cleanUser,
                    pass: cleanPass
                }
            }),
            senderEmail: cleanUser
        };
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return {
            transporter: nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            }),
            senderEmail: process.env.SMTP_USER
        };
    }

    // Fallback JSON / Console transporter for dev/preview environments without SMTP
    return {
        transporter: {
            sendMail: async (mailOptions) => {
                console.log('\n=================== [MOCK EMAIL DISPATCHED] ===================');
                console.log(`TO: ${mailOptions.to}`);
                console.log(`SUBJECT: ${mailOptions.subject}`);
                console.log(`FROM: ${mailOptions.from}`);
                console.log('-------------------- CONTENT --------------------');
                console.log(mailOptions.text || mailOptions.html);
                console.log('==========================================================\n');
                return { messageId: 'mock-' + Date.now() };
            }
        },
        senderEmail: ADMIN_NOTIFICATION_EMAIL
    };
}

function handleEmailError(context, err) {
    if (err && (err.code === 'EAUTH' || err.responseCode === 535 || (err.message && err.message.includes('BadCredentials')))) {
        console.error(`\n❌ [EmailService] Gmail Authentication Error (${context}):`);
        console.error(`   Google rejected the App_password for ${ADMIN_NOTIFICATION_EMAIL}.`);
        console.error(`   To fix this:`);
        console.error(`   1. Go to your Google Account (https://myaccount.google.com/security)`);
        console.error(`   2. Ensure 2-Step Verification is turned ON`);
        console.error(`   3. Search for "App passwords" and generate a new 16-character App Password`);
        console.error(`   4. Update "App_password" in AI Studio Secrets with the generated 16-letter code.\n`);
    } else {
        console.error(`[EmailService] Error during ${context}:`, err);
    }
}

// 1. Send Admin Notification Email when new request is submitted
async function sendNewAccessRequestNotification(data) {
    const { transporter, senderEmail } = getTransporter();
    const subject = 'New Chronicle Access Request';
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
            .card { background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
            .header { border-b: 1px solid #30363d; padding-bottom: 16px; margin-bottom: 20px; text-align: center; }
            .title { color: #f0f6fc; font-size: 20px; font-weight: 700; margin: 0; }
            .subtitle { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
            .field { margin-bottom: 16px; }
            .label { color: #8b949e; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
            .value { color: #f0f6fc; font-size: 14px; background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 10px; font-family: monospace; }
            .reason-box { background: #0d1117; border-left: 3px solid #58a6ff; border-radius: 0 6px 6px 0; padding: 12px; font-style: italic; color: #e6edf3; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <div class="subtitle">Secure Chronicle Portal</div>
                <h1 class="title">New Chronicle Access Request</h1>
            </div>
            
            <p>A new visitor has submitted an invitation request for access to Neer's Private Chronicle.</p>

            <div class="field">
                <div class="label">Applicant Name</div>
                <div class="value">${data.name}</div>
            </div>

            <div class="field">
                <div class="label">Preferred Display Name</div>
                <div class="value">${data.preferredDisplayName || data.name}</div>
            </div>

            <div class="field">
                <div class="label">Email Address</div>
                <div class="value">${data.email}</div>
            </div>

            <div class="field">
                <div class="label">Country</div>
                <div class="value">${data.country || 'Not specified'}</div>
            </div>

            <div class="field">
                <div class="label">Reason for Joining</div>
                <div class="reason-box">${data.reason}</div>
            </div>

            <div class="field">
                <div class="label">Date & Time</div>
                <div class="value">${new Date().toLocaleString()}</div>
            </div>

            <p style="color: #8b949e; font-size: 12px;">Please log in to the Chronicle Administration Portal to review and approve or reject this request.</p>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"Chronicle Security" <${senderEmail}>`,
            to: ADMIN_NOTIFICATION_EMAIL,
            subject: subject,
            html: html,
            text: `New Chronicle Access Request from ${data.name} (${data.email}). Reason: ${data.reason}`
        });
        console.log(`[EmailService] Admin notification sent successfully to ${ADMIN_NOTIFICATION_EMAIL}. Message ID: ${info.messageId}`);
    } catch (err) {
        handleEmailError('sending admin notification', err);
    }
}

// 2. Send Invitation Confirmation to Applicant
async function sendInvitationConfirmation(data) {
    const { transporter, senderEmail } = getTransporter();
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
            .card { background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: center; }
            .title { color: #f0f6fc; font-size: 22px; font-weight: 700; margin-top: 10px; }
            .badge { display: inline-block; background: rgba(56, 139, 253, 0.15); color: #58a6ff; border: 1px solid rgba(56, 139, 253, 0.4); border-radius: 20px; padding: 4px 14px; font-size: 11px; text-transform: uppercase; font-weight: 600; font-family: monospace; }
            .content { color: #8b949e; font-size: 14px; line-height: 1.6; margin: 20px 0; text-align: left; }
            .footer { border-t: 1px solid #21262d; padding-top: 16px; margin-top: 24px; color: #6e7681; font-size: 11px; }
        </style>
    </head>
    <body>
        <div class="card">
            <span class="badge">Request Status: Pending Review</span>
            <h1 class="title">Chronicle Access Request Received</h1>
            <div class="content">
                <p>Hello <strong>${data.preferredDisplayName || data.name}</strong>,</p>
                <p>Thank you for requesting access to Neer's Private Chronicle. Your request has been securely recorded and dispatched to the administrator for review.</p>
                <p>Because this journal is an invite-only chronicle, accounts are granted manually to preserve an intentional, private reading space.</p>
                <p>Once your request is approved, you will receive an email containing your assigned username and temporary password.</p>
            </div>
            <div class="footer">
                Neer's Chronicle • Authorized Journal System
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"Neer Chronicle" <${senderEmail}>`,
            to: data.email,
            subject: 'Chronicle Access Request Received',
            html: html,
            text: `Hello ${data.name}, your request to join Neer's Chronicle has been received and is under review.`
        });
        console.log(`[EmailService] Applicant confirmation email sent successfully to ${data.email}. Message ID: ${info.messageId}`);
    } catch (err) {
        handleEmailError('sending applicant confirmation', err);
    }
}

// 3. Send Credentials / Approval Email
async function sendApprovalEmail(data, assignedUsername, tempPassword) {
    const { transporter, senderEmail } = getTransporter();
    const recipientEmail = typeof data === 'string' ? data : (data.to || data.email);
    const recipientName = typeof data === 'object' ? (data.name || data.preferredDisplayName || 'Reader') : 'Reader';
    const username = typeof data === 'object' ? (data.username || data.assignedUsername || assignedUsername) : assignedUsername;
    const password = typeof data === 'object' ? (data.tempPassword || tempPassword) : tempPassword;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
            .card { background-color: #161b22; border: 1px solid #238636; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
            .title { color: #f0f6fc; font-size: 22px; font-weight: 700; margin-top: 10px; }
            .badge { display: inline-block; background: rgba(46, 160, 67, 0.15); color: #3fb950; border: 1px solid rgba(46, 160, 67, 0.4); border-radius: 20px; padding: 4px 14px; font-size: 11px; text-transform: uppercase; font-weight: 600; font-family: monospace; }
            .cred-box { background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin: 20px 0; }
            .cred-item { margin-bottom: 10px; }
            .cred-item:last-child { margin-bottom: 0; }
            .cred-label { font-size: 11px; text-transform: uppercase; color: #8b949e; font-family: monospace; font-weight: 600; }
            .cred-value { font-size: 16px; color: #f0f6fc; font-family: monospace; font-weight: 700; background: #161b22; padding: 6px 12px; border-radius: 4px; display: inline-block; margin-top: 4px; }
            .warning { color: #d29922; font-size: 12px; background: rgba(210, 153, 34, 0.1); border-left: 3px solid #d29922; padding: 10px; border-radius: 0 4px 4px 0; margin-top: 16px; }
            .footer { border-t: 1px solid #21262d; padding-top: 16px; margin-top: 24px; color: #6e7681; font-size: 11px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="card">
            <span class="badge">Invitation Approved</span>
            <h1 class="title">Welcome to Neer's Chronicle</h1>
            
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>Your access request for Neer's Chronicle has been reviewed and <strong>approved</strong> by the administrator!</p>

            <div class="cred-box">
                <div class="cred-item">
                    <div class="cred-label">Assigned Username</div>
                    <div class="cred-value">${username}</div>
                </div>
                <div class="cred-item" style="margin-top: 12px;">
                    <div class="cred-label">Temporary Password</div>
                    <div class="cred-value">${password}</div>
                </div>
            </div>

            <p><strong>Login Instructions:</strong></p>
            <ol style="color: #c9d1d9; font-size: 13px; line-height: 1.6;">
                <li>Visit the <strong style="color:#58a6ff;">Secure Chronicle Entrance</strong> page at the application login screen.</li>
                <li>Enter your assigned username and temporary password.</li>
                <li>Upon your first entrance, you may update your password in settings.</li>
            </ol>

            <div class="warning">
                🔒 <strong>Security Note:</strong> Please change your temporary password after logging in. Do not share these credentials with anyone.
            </div>

            <div class="footer">
                Neer's Chronicle • Private Reader Access Granted
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"Neer Chronicle" <${senderEmail}>`,
            to: recipientEmail,
            subject: 'Welcome to Neer\'s Chronicle - Access Granted',
            html: html,
            text: `Welcome ${recipientName}! Your request to join Neer's Chronicle has been approved. Username: ${username}, Temporary Password: ${password}`
        });
        console.log(`[EmailService] Approval credentials email sent successfully to ${recipientEmail}. Message ID: ${info.messageId}`);
    } catch (err) {
        handleEmailError('sending approval email', err);
    }
}

// 4. Send Rejection Email
async function sendRejectionEmail(data) {
    const { transporter, senderEmail } = getTransporter();
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
            .card { background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: center; }
            .title { color: #f0f6fc; font-size: 20px; font-weight: 700; margin-top: 10px; }
            .content { color: #8b949e; font-size: 14px; line-height: 1.6; margin: 20px 0; text-align: left; }
            .footer { border-t: 1px solid #21262d; padding-top: 16px; margin-top: 24px; color: #6e7681; font-size: 11px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1 class="title">Chronicle Access Request Update</h1>
            <div class="content">
                <p>Hello <strong>${data.name}</strong>,</p>
                <p>Thank you for your interest in Neer's Chronicle. After careful consideration, we are unable to approve your invitation request at this time.</p>
                <p>Because the chronicle maintains a strict capacity for private readers, invitation approvals are limited.</p>
            </div>
            <div class="footer">
                Neer's Chronicle • Private Reader Management
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"Neer Chronicle" <${senderEmail}>`,
            to: data.email,
            subject: 'Chronicle Access Request Update',
            html: html,
            text: `Hello ${data.name}, thank you for your interest in Neer's Chronicle. Unfortunately, your request could not be approved at this time.`
        });
        console.log(`[EmailService] Rejection email sent successfully to ${data.email}. Message ID: ${info.messageId}`);
    } catch (err) {
        handleEmailError('sending rejection email', err);
    }
}

module.exports = {
    ADMIN_NOTIFICATION_EMAIL,
    sendNewAccessRequestNotification,
    sendInvitationConfirmation,
    sendApprovalEmail,
    sendRejectionEmail
};
