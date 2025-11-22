const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe Price IDs:
 * - Base EHR Subscription: price_1SJ5QBKfOEPgyMAo8K8vQ2Xx ($50/month)
 * - AI NoteTaker Add-On: price_AINOTETAKER_MONTHLY ($20/month)
 *
 * To create the AI NoteTaker price in Stripe:
 * 1. Create product: "AI NoteTaker Add-On"
 * 2. Create recurring price: $20/month
 * 3. Update the frontend with the returned price ID
 */

export default async function handler(req, res) {
    // Set CORS headers
    const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            email, 
            name, 
            userId,
            priceId = 'price_1SJ5QBKfOEPgyMAo8K8vQ2Xx' // Default to $50/month price
        } = req.body;

        if (!email || !name || !userId) {
            return res.status(400).json({ 
                error: 'Missing required fields: email, name, userId' 
            });
        }

        // Create or retrieve Stripe customer
        let customer;
        const existingCustomers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({
                email: email,
                name: name,
                metadata: {
                    userId: userId,
                    source: 'sessionably'
                }
            });
        }

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                userId: userId,
                source: 'sessionably'
            }
        });

        // Return subscription data
        return res.status(200).json({
            success: true,
            subscriptionId: subscription.id,
            customerId: customer.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
            status: subscription.status
        });

    } catch (error) {
        console.error('Stripe subscription creation error:', error);
        return res.status(500).json({ 
            error: 'Failed to create subscription',
            details: error.message 
        });
    }
}
