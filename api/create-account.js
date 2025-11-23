// Create Account API Endpoint with Stripe Subscription
// Handles new user signup with subscription plan selection

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initDatabase, executeQuery } = require('./utils/database-connection');

export default async function handler(req, res) {
  // CORS headers - restrict to app domain for security
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      plan, // 'essential', 'professional', or 'complete'
      firstName,
      lastName,
      email,
      phone,
      practiceName,
      licenseNumber,
      username,
      password,
      addOn // For professional tier: 'telehealth' or 'ai_notes'
    } = req.body;

    // Validate required fields
    if (!plan || !firstName || !lastName || !email || !practiceName || !username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['plan', 'firstName', 'lastName', 'email', 'practiceName', 'username', 'password']
      });
    }

    // Validate plan
    const validPlans = ['essential', 'professional', 'complete'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        error: 'Invalid plan',
        validPlans
      });
    }

    // Validate add-on for professional tier
    if (plan === 'professional' && !addOn) {
      return res.status(400).json({
        error: 'Professional tier requires add-on selection',
        validAddOns: ['telehealth', 'ai_notes']
      });
    }

    // Initialize database connection
    const dbConnected = await initDatabase();

    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database unavailable',
        message: 'Please try again later'
      });
    }

    // Check if username already exists
    const existingUser = await executeQuery(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.data.length > 0) {
      return res.status(409).json({
        error: 'Username already taken',
        message: 'Please choose a different username'
      });
    }

    // Check if email already exists
    const existingEmail = await executeQuery(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail.data.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email already exists'
      });
    }

    // Create Stripe customer
    let stripeCustomer;
    try {
      stripeCustomer = await stripe.customers.create({
        email: email,
        name: `${firstName} ${lastName}`,
        metadata: {
          practice_name: practiceName,
          license_number: licenseNumber || '',
          username: username
        }
      });
    } catch (stripeError) {
      console.error('Stripe customer creation error:', stripeError);
      return res.status(500).json({
        error: 'Payment setup failed',
        message: 'Unable to create payment profile'
      });
    }

    // Determine price ID based on plan
    // NOTE: These will need to be created in Stripe Dashboard first
    const priceIds = {
      essential: process.env.STRIPE_PRICE_ESSENTIAL || 'price_essential_placeholder',
      professional_telehealth: process.env.STRIPE_PRICE_PROFESSIONAL_TELEHEALTH || 'price_prof_telehealth_placeholder',
      professional_ai: process.env.STRIPE_PRICE_PROFESSIONAL_AI || 'price_prof_ai_placeholder',
      complete: process.env.STRIPE_PRICE_COMPLETE || 'price_complete_placeholder'
    };

    let priceId;
    if (plan === 'essential') {
      priceId = priceIds.essential;
    } else if (plan === 'professional') {
      priceId = addOn === 'telehealth' ? priceIds.professional_telehealth : priceIds.professional_ai;
    } else {
      priceId = priceIds.complete;
    }

    // Create Stripe subscription with 7-day trial
    let subscription;
    try {
      subscription = await stripe.subscriptions.create({
        customer: stripeCustomer.id,
        items: [{ price: priceId }],
        trial_period_days: 7,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          plan: plan,
          add_on: addOn || 'none',
          username: username
        }
      });
    } catch (stripeError) {
      console.error('Stripe subscription creation error:', stripeError);

      // Clean up customer if subscription fails
      try {
        await stripe.customers.del(stripeCustomer.id);
      } catch (e) {
        console.error('Failed to clean up Stripe customer:', e);
      }

      return res.status(500).json({
        error: 'Subscription setup failed',
        message: 'Unable to create subscription'
      });
    }

    // Hash password (in production, use bcrypt)
    // For now, we'll use a simple hash (REPLACE WITH BCRYPT IN PRODUCTION)
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Create user in database
    const userResult = await executeQuery(
      `INSERT INTO users (username, password_hash, email, full_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, username, email, full_name, role`,
      [username, passwordHash, email, `${firstName} ${lastName}`]
    );

    if (userResult.data.length === 0) {
      // Failed to create user - clean up Stripe
      try {
        await stripe.subscriptions.del(subscription.id);
        await stripe.customers.del(stripeCustomer.id);
      } catch (e) {
        console.error('Failed to clean up Stripe after user creation failure:', e);
      }

      return res.status(500).json({
        error: 'Account creation failed',
        message: 'Unable to create user account'
      });
    }

    const user = userResult.data[0];

    // Create practice settings
    await executeQuery(
      `INSERT INTO practice_settings (user_id, practice_name, practice_phone, practice_email, provider_license, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [user.id, practiceName, phone || '', email, licenseNumber || '']
    );

    // Store subscription info (you may want to create a subscriptions table)
    // For now, we'll log it and return it
    console.log('✅ Account created:', {
      userId: user.id,
      username: user.username,
      stripeCustomerId: stripeCustomer.id,
      subscriptionId: subscription.id,
      plan: plan,
      addOn: addOn || 'none',
      trialEnds: new Date(subscription.trial_end * 1000)
    });

    // Return success
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: plan,
        addOn: addOn || 'none',
        trialEnd: new Date(subscription.trial_end * 1000),
        amount: plan === 'essential' ? 40 : plan === 'complete' ? 80 : 60
      },
      nextSteps: {
        message: 'Your 7-day free trial has started!',
        actions: [
          'Complete your practice profile',
          'Add your first client',
          'Explore features',
          'Add payment method before trial ends'
        ]
      }
    });

  } catch (error) {
    console.error('Account creation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
