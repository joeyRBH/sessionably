// Client Portal Registration API
// Handles new client account creation and email verification

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

    const { clientId, email, password, verificationCode } = req.body;

    // Validate input
    if (!clientId || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Client ID, email, and password are required'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check if client exists
    const clientResult = await executeQuery(
      'SELECT * FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const client = clientResult.data[0];

    // Verify client email matches
    if (client.email && client.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Email does not match client record'
      });
    }

    // Check if user already exists
    const existingUserResult = await executeQuery(
      'SELECT * FROM client_users WHERE email = $1 OR client_id = $2',
      [email.toLowerCase(), clientId]
    );

    if (existingUserResult.data.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account already exists for this client or email'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create client user account
    const createUserResult = await executeQuery(
      `INSERT INTO client_users
       (client_id, email, password_hash, verification_token, is_active, is_verified)
       VALUES ($1, $2, $3, $4, true, false)
       RETURNING id, email, client_id, created_at`,
      [clientId, email.toLowerCase(), passwordHash, verificationToken]
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
       VALUES ($1, 'client', 'register', 'client_user', $2, $3, $4)`,
      [clientId, newUser.id, ipAddress, userAgent]
    );

    // Send verification email
    const verificationLink = `${process.env.APP_URL || 'https://sessionably.com'}/client-portal.html?verify=${verificationToken}`;

    try {
      await sendEmail({
        to: email,
        subject: 'Verify Your Client Portal Account',
        html: `
          <h2>Welcome to the Client Portal</h2>
          <p>Hello ${client.name},</p>
          <p>Thank you for creating your client portal account. Please verify your email address by clicking the link below:</p>
          <p><a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p>${verificationLink}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not create this account, please ignore this email.</p>
        `,
        text: `Welcome to the Client Portal! Please verify your email by visiting: ${verificationLink}`
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue even if email fails - user can request resend
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      data: {
        id: newUser.id,
        email: newUser.email,
        clientId: newUser.client_id,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Client registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
