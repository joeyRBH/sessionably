// Client Portal Quick Setup
// Auto-creates client portal account from document access code

const { initDatabase, executeQuery } = require('./utils/database-connection');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendEmail } = require('./utils/notifications');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    await initDatabase();

    const { accessCode, password } = req.body;

    // Validate input
    if (!accessCode || !password) {
      return res.status(400).json({
        success: false,
        error: 'Access code and password are required'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Find client by access code
    const assignedDocResult = await executeQuery(
      `SELECT ad.client_id, c.name, c.email, c.phone
       FROM assigned_documents ad
       JOIN clients c ON ad.client_id = c.id
       WHERE ad.access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (assignedDocResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invalid access code'
      });
    }

    const client = assignedDocResult.data[0];
    const clientId = client.client_id;
    const email = client.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'No email address on file. Please contact your provider to update your contact information.'
      });
    }

    // Check if user already exists
    const existingUserResult = await executeQuery(
      'SELECT * FROM client_users WHERE client_id = $1',
      [clientId]
    );

    if (existingUserResult.data.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Portal account already exists. Please use the login page.',
        existingAccount: true
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create client user account
    const createUserResult = await executeQuery(
      `INSERT INTO client_users
       (client_id, email, password_hash, is_active, is_verified)
       VALUES ($1, $2, $3, true, true)
       RETURNING id, email, client_id, created_at`,
      [clientId, email.toLowerCase(), passwordHash]
    );

    const newUser = createUserResult.data[0];

    // Create default notification settings
    await executeQuery(
      `INSERT INTO client_notification_settings
       (client_id, email_notifications, sms_notifications,
        email_appointment_reminders, email_invoice_reminders,
        email_document_updates, preferred_contact_method)
       VALUES ($1, true, false, true, true, true, 'email')`,
      [clientId]
    );

    // Get IP address for audit log
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Log registration in audit log
    await executeQuery(
      `INSERT INTO audit_log
       (user_id, user_type, action, entity_type, entity_id, ip_address, user_agent)
       VALUES ($1, 'client', 'quick_setup', 'client_user', $2, $3, $4)`,
      [clientId, newUser.id, ipAddress, userAgent]
    );

    // Send welcome email
    try {
      const portalLink = `${process.env.APP_URL || 'https://sessionably.com'}/client-portal.html`;

      await sendEmail({
        to: email,
        subject: 'Welcome to Your Client Portal',
        html: `
          <h2>Your Client Portal is Ready!</h2>
          <p>Hello ${client.name},</p>
          <p>Your client portal account has been created successfully. You can now:</p>
          <ul>
            <li>View your appointments</li>
            <li>Check invoices and billing</li>
            <li>Access your documents</li>
            <li>Manage notification preferences</li>
            <li>Send secure messages to your provider</li>
          </ul>
          <p><a href="${portalLink}" style="background-color: #00b4a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Access Client Portal</a></p>
          <p>Login with your email: <strong>${email}</strong></p>
          <p>If you have any questions, please contact your provider.</p>
        `,
        text: `Welcome to Your Client Portal! Your account has been created. Access it at: ${portalLink} using email: ${email}`
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'Portal account created successfully!',
      data: {
        id: newUser.id,
        email: newUser.email,
        clientId: newUser.client_id,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Client quick setup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
