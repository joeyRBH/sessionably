// Email and SMS Notification Utility
// Handles AWS SES (email) and AWS SNS (SMS) integration

const { Pool } = require('pg');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Database connection pool
let pool;
function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
        });
    }
    return pool;
}

/**
 * Fetch practice settings from database
 * @param {String} userId - User ID to fetch settings for
 * @returns {Promise<Object>} - Practice settings object
 */
async function getPracticeSettings(userId) {
    if (!userId) {
        console.log('⚠️  No user ID provided, using default practice settings');
        return {};
    }

    try {
        const db = getPool();
        const result = await db.query(
            'SELECT * FROM practice_settings WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            console.log('⚠️  No practice settings found for user:', userId);
            return {};
        }

        return result.rows[0];
    } catch (error) {
        console.error('❌ Error fetching practice settings:', error.message);
        return {};
    }
}

/**
 * Create HTML email template with practice branding
 * @param {String} bodyContent - Main email content
 * @param {Object} practiceSettings - Practice information
 * @returns {String} - HTML email
 */
function createHTMLEmail(bodyContent, practiceSettings = {}) {
    const practiceName = practiceSettings.practice_name || 'Your Practice';
    const practicePhone = practiceSettings.practice_phone || '';
    const practiceEmail = practiceSettings.practice_email || '';
    const practiceWebsite = practiceSettings.practice_website || '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background-color: #2c3e50;
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .content p {
            margin: 0 0 15px 0;
        }
        .info-block {
            background-color: #f8f9fa;
            border-left: 4px solid #2c3e50;
            padding: 15px;
            margin: 20px 0;
        }
        .contact-info {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 14px;
            color: #666;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e0e0e0;
        }
        .footer a {
            color: #00b4a6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${practiceName}</h1>
        </div>
        <div class="content">
            ${bodyContent}

            <div class="contact-info">
                <strong>Contact Information:</strong><br>
                ${practicePhone ? `Phone: ${practicePhone}<br>` : ''}
                ${practiceEmail ? `Email: ${practiceEmail}<br>` : ''}
                ${practiceWebsite ? `Website: ${practiceWebsite}` : ''}
            </div>
        </div>
        <div class="footer">
            <p>Powered by <a href="https://sessionably.com">Sessionably</a> - HIPAA Compliant Messenger</p>
            <p>This is a secure, encrypted communication from ${practiceName}</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Send email via AWS SES
 * @param {Object} emailData - { to, subject, body, html, from, fromName, practiceSettings }
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
async function sendEmail(emailData) {
    const {
        to,
        subject,
        body,
        html,
        from = process.env.AWS_SES_FROM_EMAIL || 'noreply@sessionably.com',
        fromName,
        practiceSettings = {}
    } = emailData;

    // Use practice name if available, otherwise use environment variable or default
    const senderName = fromName || practiceSettings.practice_name || process.env.AWS_SES_FROM_NAME || 'Sessionably';

    // Check if AWS SES is configured
    if (!process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY || !process.env.AWS_SES_REGION) {
        const error = 'AWS SES credentials not configured. Required: AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, AWS_SES_REGION';
        console.error('❌ EMAIL ERROR:', error);
        return {
            success: false,
            message: error,
            provider: 'AWS SES'
        };
    }

    try {
        // Initialize SES client
        const sesClient = new SESClient({
            region: process.env.AWS_SES_REGION,
            credentials: {
                accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY
            }
        });

        // If HTML is not provided, create it from body with practice branding
        const emailHTML = html || createHTMLEmail(
            body.replace(/\n/g, '<br>'),
            practiceSettings
        );

        // Prepare email parameters
        const params = {
            Source: `${senderName} <${from}>`,
            Destination: {
                ToAddresses: [to]
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Text: {
                        Data: body,
                        Charset: 'UTF-8'
                    },
                    Html: {
                        Data: emailHTML,
                        Charset: 'UTF-8'
                    }
                }
            }
        };

        const command = new SendEmailCommand(params);
        const result = await sesClient.send(command);

        console.log('✅ Email sent via AWS SES to:', to);
        console.log('   Message ID:', result.MessageId);

        return {
            success: true,
            message: 'Email sent successfully via AWS SES',
            messageId: result.MessageId,
            provider: 'AWS SES'
        };
    } catch (error) {
        console.error('❌ AWS SES email send failed:', error.message);
        return {
            success: false,
            message: error.message,
            provider: 'AWS SES'
        };
    }
}

/**
 * Send SMS via AWS SNS
 * @param {Object} smsData - { to, body }
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
async function sendSMS(smsData) {
    const { to, body } = smsData;

    // Check if AWS SNS is configured
    if (!process.env.AWS_SNS_ACCESS_KEY_ID || !process.env.AWS_SNS_SECRET_ACCESS_KEY || !process.env.AWS_SNS_REGION) {
        const error = 'AWS SNS credentials not configured. Required: AWS_SNS_ACCESS_KEY_ID, AWS_SNS_SECRET_ACCESS_KEY, AWS_SNS_REGION';
        console.error('❌ SMS ERROR:', error);
        return {
            success: false,
            message: error,
            provider: 'AWS SNS'
        };
    }

    try {
        // Initialize SNS client
        const snsClient = new SNSClient({
            region: process.env.AWS_SNS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY
            }
        });

        // Prepare SMS parameters
        const params = {
            Message: body,
            PhoneNumber: to,
            MessageAttributes: {
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional' // Use 'Transactional' for critical messages
                }
            }
        };

        const command = new PublishCommand(params);
        const result = await snsClient.send(command);

        console.log('✅ SMS sent successfully via AWS SNS to:', to);
        console.log('   Message ID:', result.MessageId);

        return {
            success: true,
            message: 'SMS sent successfully via AWS SNS',
            messageId: result.MessageId,
            provider: 'AWS SNS'
        };
    } catch (error) {
        console.error('❌ AWS SNS SMS send failed:', error.message);
        return {
            success: false,
            message: error.message,
            provider: 'AWS SNS'
        };
    }
}

/**
 * Send both email and SMS (dual notification)
 * @param {Object} notificationData - { to, email, phone, subject, body, html, practiceSettings }
 * @returns {Promise<Object>} - { email: {...}, sms: {...} }
 */
async function sendDualNotification(notificationData) {
    const { to, email, phone, subject, body, html, practiceSettings = {} } = notificationData;

    const results = {
        email: { success: false, message: 'Not sent' },
        sms: { success: false, message: 'Not sent' }
    };

    // Send email if email address provided
    if (email) {
        results.email = await sendEmail({
            to: email,
            subject,
            body,
            html,
            practiceSettings
        });
    }

    // Send SMS if phone number provided
    if (phone) {
        results.sms = await sendSMS({
            to: phone,
            body: `${subject}\n\n${body}`
        });
    }

    return results;
}

/**
 * Notification templates
 */
const templates = {
    paymentReceived: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { invoice } = data;

        return {
            subject: `Payment Received - Invoice ${invoice.invoice_number}`,
            body: `
Dear ${invoice.client_name},

We have received your payment of $${parseFloat(invoice.total_amount).toFixed(2)} for invoice ${invoice.invoice_number}.

Thank you for your payment!

If you have any questions, please don't hesitate to contact us.

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${invoice.client_name},</p>
                <p>We have received your payment of <strong>$${parseFloat(invoice.total_amount).toFixed(2)}</strong> for invoice ${invoice.invoice_number}.</p>
                <div class="info-block">
                    <strong>Payment Confirmed</strong><br>
                    Invoice: ${invoice.invoice_number}<br>
                    Amount: $${parseFloat(invoice.total_amount).toFixed(2)}
                </div>
                <p>Thank you for your payment!</p>
                <p>If you have any questions, please don't hesitate to contact us.</p>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    },

    paymentFailed: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { invoice, error } = data;

        return {
            subject: `Payment Failed - Invoice ${invoice.invoice_number}`,
            body: `
Dear ${invoice.client_name},

We were unable to process your payment for invoice ${invoice.invoice_number}.
Error: ${error}

Please update your payment method or contact us to resolve this issue.

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${invoice.client_name},</p>
                <p>We were unable to process your payment for invoice ${invoice.invoice_number}.</p>
                <div class="info-block">
                    <strong>Payment Failed</strong><br>
                    Invoice: ${invoice.invoice_number}<br>
                    Error: ${error}
                </div>
                <p>Please update your payment method or contact us to resolve this issue.</p>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    },

    refundProcessed: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { invoice, refundAmount } = data;

        return {
            subject: `Refund Processed - Invoice ${invoice.invoice_number}`,
            body: `
Dear ${invoice.client_name},

A refund of $${parseFloat(refundAmount).toFixed(2)} has been processed for invoice ${invoice.invoice_number}.

The refund will appear on your account within 5-10 business days.

If you have any questions, please contact us.

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${invoice.client_name},</p>
                <p>A refund has been processed for invoice ${invoice.invoice_number}.</p>
                <div class="info-block">
                    <strong>Refund Processed</strong><br>
                    Invoice: ${invoice.invoice_number}<br>
                    Refund Amount: $${parseFloat(refundAmount).toFixed(2)}
                </div>
                <p>The refund will appear on your account within 5-10 business days.</p>
                <p>If you have any questions, please contact us.</p>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    },

    invoiceCreated: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { invoice } = data;

        return {
            subject: `New Invoice - ${invoice.invoice_number}`,
            body: `
Dear ${invoice.client_name},

A new invoice has been created for you:

Invoice Number: ${invoice.invoice_number}
Amount: $${parseFloat(invoice.total_amount).toFixed(2)}
Due Date: ${new Date(invoice.due_date).toLocaleDateString()}

Please log in to view and pay your invoice.

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${invoice.client_name},</p>
                <p>A new invoice has been created for you:</p>
                <div class="info-block">
                    <strong>Invoice Details</strong><br>
                    Invoice Number: ${invoice.invoice_number}<br>
                    Amount: $${parseFloat(invoice.total_amount).toFixed(2)}<br>
                    Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
                </div>
                <p>Please log in to view and pay your invoice.</p>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    },

    autopayEnabled: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { client } = data;

        return {
            subject: `Autopay Enabled`,
            body: `
Dear ${client.name},

Autopay has been enabled for your account. Future invoices will be automatically charged to your default payment method.

You can manage your autopay settings at any time by logging into your account.

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${client.name},</p>
                <p>Autopay has been enabled for your account.</p>
                <div class="info-block">
                    <strong>Autopay Enabled</strong><br>
                    Future invoices will be automatically charged to your default payment method.
                </div>
                <p>You can manage your autopay settings at any time by logging into your account.</p>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    },

    autopayFailed: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { invoice, error } = data;

        return {
            subject: `Autopay Failed - Invoice ${invoice.invoice_number}`,
            body: `
Dear ${invoice.client_name},

We were unable to process your automatic payment for invoice ${invoice.invoice_number}.
Error: ${error}

Please update your payment method or contact us to resolve this issue.

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${invoice.client_name},</p>
                <p>We were unable to process your automatic payment for invoice ${invoice.invoice_number}.</p>
                <div class="info-block">
                    <strong>Autopay Failed</strong><br>
                    Invoice: ${invoice.invoice_number}<br>
                    Error: ${error}
                </div>
                <p>Please update your payment method or contact us to resolve this issue.</p>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    },

    appointmentReminder: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { appointment } = data;
        const isTelehealth = appointment.modality === 'telehealth';

        // Build the body text
        let bodyText = `
Dear ${appointment.client_name},

This is a reminder that you have an appointment scheduled for:

Date: ${new Date(appointment.appointment_date).toLocaleDateString()}
Time: ${appointment.appointment_time}
Duration: ${appointment.duration} minutes
Type: ${appointment.type}
Modality: ${isTelehealth ? 'Telehealth (Video)' : 'In-Person'}
`;

        if (isTelehealth && appointment.telehealth_link) {
            bodyText += `\nJoin your video session here:\n${appointment.telehealth_link}\n\nPlease join 5 minutes early to test your connection.`;
        } else if (!isTelehealth) {
            bodyText += `\nPlease arrive 10 minutes early.`;
        }

        bodyText += `\n\nBest regards,\n${practiceName}`;

        // Build the HTML
        let htmlContent = `
                <p>Dear ${appointment.client_name},</p>
                <p>This is a reminder that you have an appointment scheduled for:</p>
                <div class="info-block">
                    <strong>Appointment Details</strong><br>
                    Date: ${new Date(appointment.appointment_date).toLocaleDateString()}<br>
                    Time: ${appointment.appointment_time}<br>
                    Duration: ${appointment.duration} minutes<br>
                    Type: ${appointment.type}<br>
                    Modality: ${isTelehealth ? '<strong>Telehealth (Video)</strong>' : 'In-Person'}
                </div>
`;

        if (isTelehealth && appointment.telehealth_link) {
            htmlContent += `
                <div class="info-block" style="background-color: #e8f5e9; border-left-color: #4caf50;">
                    <strong>🎥 Join Video Session</strong><br>
                    <a href="${appointment.telehealth_link}" style="color: #2c3e50; font-weight: bold; text-decoration: underline;">${appointment.telehealth_link}</a>
                </div>
                <p><strong>Please join 5 minutes early to test your connection.</strong></p>
`;
        } else if (!isTelehealth) {
            htmlContent += `<p>Please arrive 10 minutes early.</p>`;
        }

        htmlContent += `<p>Best regards,<br>${practiceName}</p>`;

        return {
            subject: `Appointment Reminder - ${new Date(appointment.appointment_date).toLocaleDateString()}${isTelehealth ? ' (Telehealth)' : ''}`,
            body: bodyText.trim(),
            html: createHTMLEmail(htmlContent, practiceSettings)
        };
    },

    documentAssigned: (data, practiceSettings = {}) => {
        const practiceName = practiceSettings.practice_name || 'Your Practice';
        const { client, document } = data;

        return {
            subject: `New Document to Complete`,
            body: `
Dear ${client.name},

A new document has been assigned to you: ${document.template_name}

To complete this document securely, please visit:
https://sessionably.vercel.app/client-portal

Your secure access code: ${document.auth_code}

This code will expire in 7 days for security purposes.

For your protection:
- Do not share this code with anyone
- Access the portal only from a secure device
- Contact us if you did not request this document

Best regards,
${practiceName}
            `.trim(),
            html: createHTMLEmail(`
                <p>Dear ${client.name},</p>
                <p>A new document has been assigned to you: <strong>${document.template_name}</strong></p>
                <div class="info-block">
                    <strong>Secure Access Information</strong><br>
                    Portal: <a href="https://sessionably.vercel.app/client-portal">https://sessionably.vercel.app/client-portal</a><br>
                    Access Code: <strong>${document.auth_code}</strong><br>
                    Expires: 7 days
                </div>
                <p><strong>For your protection:</strong></p>
                <ul>
                    <li>Do not share this code with anyone</li>
                    <li>Access the portal only from a secure device</li>
                    <li>Contact us if you did not request this document</li>
                </ul>
                <p>Best regards,<br>${practiceName}</p>
            `, practiceSettings)
        };
    }
};

/**
 * Send notification using template
 * @param {String} templateName - Template name from templates object
 * @param {Object} data - Data for template
 * @param {Object} contact - { email, phone }
 * @param {Object} practiceSettings - Practice information for branding
 * @returns {Promise<Object>} - Notification results
 */
async function sendTemplateNotification(templateName, data, contact, practiceSettings = {}) {
    const template = templates[templateName];

    if (!template) {
        return {
            success: false,
            message: `Template "${templateName}" not found`
        };
    }

    const { subject, body, html } = template(data, practiceSettings);

    return await sendDualNotification({
        to: contact.email || contact.phone,
        email: contact.email,
        phone: contact.phone,
        subject,
        body,
        html,
        practiceSettings
    });
}

/**
 * Get client notification settings
 * @param {Number} clientId - Client ID
 * @returns {Promise<Object>} - Client notification settings
 */
async function getClientNotificationSettings(clientId) {
    if (!clientId) {
        console.log('⚠️  No client ID provided');
        return null;
    }

    try {
        const db = getPool();
        const result = await db.query(
            'SELECT * FROM client_notification_settings WHERE client_id = $1',
            [clientId]
        );

        if (result.rows.length === 0) {
            console.log('⚠️  No notification settings found for client:', clientId);
            // Return default settings
            return {
                email_notifications: true,
                sms_notifications: false,
                email_appointment_reminders: true,
                email_appointment_confirmations: true,
                email_invoice_reminders: true,
                email_payment_receipts: true,
                email_document_updates: true,
                sms_appointment_reminders: false,
                sms_appointment_confirmations: false,
                sms_invoice_reminders: false,
                sms_payment_receipts: false,
                preferred_contact_method: 'email',
                quiet_hours_enabled: false
            };
        }

        return result.rows[0];
    } catch (error) {
        console.error('❌ Error fetching client notification settings:', error.message);
        return null;
    }
}

/**
 * Check if notification is allowed based on quiet hours
 * @param {Object} settings - Client notification settings
 * @returns {Boolean} - True if notification is allowed
 */
function isOutsideQuietHours(settings) {
    if (!settings || !settings.quiet_hours_enabled || !settings.quiet_hours_start || !settings.quiet_hours_end) {
        return true; // No quiet hours restriction
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const startTime = settings.quiet_hours_start;
    const endTime = settings.quiet_hours_end;

    // If quiet hours span midnight
    if (startTime > endTime) {
        return currentTime < startTime && currentTime >= endTime;
    }

    // Normal quiet hours (same day)
    return currentTime < startTime || currentTime >= endTime;
}

/**
 * Log notification to database
 * @param {Object} logData - Notification log data
 * @returns {Promise<Object>} - Log entry
 */
async function logNotification(logData) {
    const {
        clientId,
        notificationType,
        notificationCategory,
        subject,
        message,
        deliveryMethod,
        recipientEmail,
        recipientPhone,
        status,
        relatedEntityType,
        relatedEntityId,
        metadata
    } = logData;

    try {
        const db = getPool();
        const result = await db.query(
            `INSERT INTO notification_log
             (client_id, notification_type, notification_category, subject, message,
              delivery_method, recipient_email, recipient_phone, status,
              sent_at, related_entity_type, related_entity_id, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                clientId,
                notificationType,
                notificationCategory || null,
                subject,
                message,
                deliveryMethod,
                recipientEmail || null,
                recipientPhone || null,
                status,
                status === 'sent' || status === 'delivered' ? new Date() : null,
                relatedEntityType || null,
                relatedEntityId || null,
                metadata ? JSON.stringify(metadata) : null
            ]
        );

        return result.rows[0];
    } catch (error) {
        console.error('❌ Error logging notification:', error.message);
        return null;
    }
}

/**
 * Send notification to client respecting their preferences
 * @param {Object} notificationData - Notification data with client preferences
 * @returns {Promise<Object>} - Send results
 */
async function sendClientNotification(notificationData) {
    const {
        clientId,
        clientEmail,
        clientPhone,
        notificationType, // e.g., 'appointment_reminder', 'invoice_reminder', 'document_update'
        subject,
        body,
        html,
        practiceSettings = {},
        relatedEntityType,
        relatedEntityId,
        metadata = {}
    } = notificationData;

    // Validate inputs
    if (!clientId) {
        console.error('❌ Client ID is required for sendClientNotification');
        return { success: false, message: 'Client ID is required' };
    }

    // Get client notification settings
    const settings = await getClientNotificationSettings(clientId);

    if (!settings) {
        console.log('⚠️  Could not fetch settings, using defaults');
    }

    // Check quiet hours
    if (settings && !isOutsideQuietHours(settings)) {
        console.log(`⏰ Skipping notification due to quiet hours for client ${clientId}`);
        await logNotification({
            clientId,
            notificationType,
            notificationCategory: 'system',
            subject,
            message: body,
            deliveryMethod: 'none',
            recipientEmail: clientEmail,
            recipientPhone: clientPhone,
            status: 'skipped',
            relatedEntityType,
            relatedEntityId,
            metadata: { ...metadata, reason: 'quiet_hours' }
        });
        return { success: false, message: 'Skipped due to quiet hours' };
    }

    const results = {
        email: { success: false, message: 'Not sent' },
        sms: { success: false, message: 'Not sent' }
    };

    // Determine if email should be sent
    let sendEmailNotification = false;
    if (settings) {
        if (!settings.email_notifications) {
            sendEmailNotification = false;
        } else if (notificationType === 'appointment_reminder' && settings.email_appointment_reminders) {
            sendEmailNotification = true;
        } else if (notificationType === 'appointment_confirmation' && settings.email_appointment_confirmations) {
            sendEmailNotification = true;
        } else if (notificationType === 'invoice_reminder' && settings.email_invoice_reminders) {
            sendEmailNotification = true;
        } else if (notificationType === 'payment_receipt' && settings.email_payment_receipts) {
            sendEmailNotification = true;
        } else if (notificationType === 'document_update' && settings.email_document_updates) {
            sendEmailNotification = true;
        } else if (settings.email_notifications) {
            // Send other notifications if email is enabled
            sendEmailNotification = true;
        }
    } else {
        // Default to sending email if settings not found
        sendEmailNotification = clientEmail ? true : false;
    }

    // Send email
    if (sendEmailNotification && clientEmail) {
        results.email = await sendEmail({
            to: clientEmail,
            subject,
            body,
            html,
            practiceSettings
        });

        // Log email notification
        await logNotification({
            clientId,
            notificationType,
            notificationCategory: 'email',
            subject,
            message: body,
            deliveryMethod: 'email',
            recipientEmail: clientEmail,
            status: results.email.success ? 'sent' : 'failed',
            relatedEntityType,
            relatedEntityId,
            metadata: { ...metadata, messageId: results.email.messageId }
        });
    }

    // Determine if SMS should be sent
    let sendSMSNotification = false;
    if (settings) {
        if (!settings.sms_notifications) {
            sendSMSNotification = false;
        } else if (notificationType === 'appointment_reminder' && settings.sms_appointment_reminders) {
            sendSMSNotification = true;
        } else if (notificationType === 'appointment_confirmation' && settings.sms_appointment_confirmations) {
            sendSMSNotification = true;
        } else if (notificationType === 'invoice_reminder' && settings.sms_invoice_reminders) {
            sendSMSNotification = true;
        } else if (notificationType === 'payment_receipt' && settings.sms_payment_receipts) {
            sendSMSNotification = true;
        } else if (settings.sms_notifications) {
            // Send other notifications if SMS is enabled
            sendSMSNotification = true;
        }
    } else {
        // Default to not sending SMS unless explicitly enabled
        sendSMSNotification = false;
    }

    // Send SMS
    if (sendSMSNotification && clientPhone) {
        results.sms = await sendSMS({
            to: clientPhone,
            body: `${subject}\n\n${body}`
        });

        // Log SMS notification
        await logNotification({
            clientId,
            notificationType,
            notificationCategory: 'sms',
            subject,
            message: body,
            deliveryMethod: 'sms',
            recipientPhone: clientPhone,
            status: results.sms.success ? 'sent' : 'failed',
            relatedEntityType,
            relatedEntityId,
            metadata: { ...metadata, messageId: results.sms.messageId }
        });
    }

    return {
        success: results.email.success || results.sms.success,
        email: results.email,
        sms: results.sms
    };
}

module.exports = {
    sendEmail,
    sendSMS,
    sendDualNotification,
    sendTemplateNotification,
    sendClientNotification,
    getClientNotificationSettings,
    logNotification,
    createHTMLEmail,
    getPracticeSettings,
    templates
};
