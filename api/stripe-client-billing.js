// Stripe Client Billing API Endpoint for Vercel
// This handles sending payment requests to clients via email/SMS
// Allows therapists to charge clients securely through Stripe

const { Pool } = require('pg');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

  try {
    const {
      action,
      invoice_id,
      client_id,
      amount,
      description,
      send_via, // 'email', 'sms', or 'both'
      due_date,
      payment_link_expiry = 30 // days until payment link expires
    } = req.body;

    // Validate required fields based on action
    if (action === 'create_payment_link') {
      if (!invoice_id || !client_id || !amount || !description || !send_via) {
        return res.status(400).json({
          error: 'Missing required fields: invoice_id, client_id, amount, description, send_via'
        });
      }

      // Validate amount (must be positive)
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
          error: 'Amount must be a positive number'
        });
      }

      // Initialize Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      // Get client information from database
      const clientQuery = await client.query(
        'SELECT id, first_name, last_name, email, phone FROM clients WHERE id = $1',
        [client_id]
      );

      if (clientQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const clientInfo = clientQuery.rows[0];
      const clientEmail = clientInfo.email;
      const clientPhone = clientInfo.phone;
      const clientName = `${clientInfo.first_name} ${clientInfo.last_name}`;

      // Check if client has a Stripe customer ID
      let stripeCustomerId = clientInfo.stripe_customer_id;

      if (!stripeCustomerId) {
        // Create Stripe customer for this client
        const customer = await stripe.customers.create({
          email: clientEmail,
          name: clientName,
          phone: clientPhone,
          metadata: {
            client_id: client_id,
            source: 'Sessionably'
          }
        });

        stripeCustomerId = customer.id;

        // Update database with Stripe customer ID
        await client.query(
          'UPDATE clients SET stripe_customer_id = $1 WHERE id = $2',
          [stripeCustomerId, client_id]
        );
      }

      // Create Stripe Payment Link
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: description,
                description: `Invoice #${invoice_id}`
              },
              unit_amount: Math.round(amount * 100) // Convert to cents
            },
            quantity: 1
          }
        ],
        metadata: {
          invoice_id: invoice_id,
          client_id: client_id,
          client_name: clientName
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: `${req.headers.origin || 'https://sessionably.com'}/client-portal#payment-success`
          }
        },
        allow_promotion_codes: false,
        billing_address_collection: 'auto',
        customer_creation: 'if_required',
        phone_number_collection: {
          enabled: true
        }
      });

      // Update invoice with payment link
      await client.query(
        'UPDATE invoices SET stripe_payment_link = $1, stripe_payment_link_created_at = NOW() WHERE id = $2',
        [paymentLink.url, invoice_id]
      );

      // Send notification based on send_via preference
      const AWS = require('aws-sdk');
      const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });
      const sns = new AWS.SNS({ region: process.env.AWS_REGION || 'us-east-1' });

      const dueDateText = due_date
        ? `Due by: ${new Date(due_date).toLocaleDateString()}`
        : 'Due upon receipt';

      // Send via email
      if ((send_via === 'email' || send_via === 'both') && clientEmail) {
        const emailParams = {
          Source: process.env.NOTIFICATION_EMAIL || 'noreply@sessionably.com',
          Destination: {
            ToAddresses: [clientEmail]
          },
          Message: {
            Subject: {
              Data: `Invoice #${invoice_id} - Payment Request`,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: #00B4A6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                      .content { background: #ffffff; padding: 30px; border: 1px solid #e8eaed; }
                      .invoice-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                      .amount { font-size: 32px; font-weight: bold; color: #00B4A6; }
                      .button { display: inline-block; background: #00B4A6; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                      .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1 style="margin: 0;">Payment Request</h1>
                      </div>
                      <div class="content">
                        <p>Hello ${clientName},</p>
                        <p>You have a new invoice that requires payment.</p>

                        <div class="invoice-details">
                          <p style="margin: 0; font-weight: 600;">Invoice #${invoice_id}</p>
                          <p style="margin: 5px 0;">${description}</p>
                          <p style="margin: 5px 0;">${dueDateText}</p>
                          <div class="amount">$${amount.toFixed(2)}</div>
                        </div>

                        <p>Click the button below to securely pay your invoice:</p>
                        <div style="text-align: center;">
                          <a href="${paymentLink.url}" class="button">Pay Invoice</a>
                        </div>

                        <p style="margin-top: 30px; font-size: 14px; color: #666;">
                          This payment link will expire in ${payment_link_expiry} days.
                          All transactions are securely processed through Stripe.
                        </p>
                      </div>
                      <div class="footer">
                        <p>This is an automated message from Sessionably</p>
                        <p>If you have questions, please contact your therapist</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `,
                Charset: 'UTF-8'
              }
            }
          }
        };

        try {
          await ses.sendEmail(emailParams).promise();

          // Log notification
          await client.query(
            `INSERT INTO notification_log (client_id, type, channel, status, message, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              client_id,
              'payment_request',
              'email',
              'sent',
              `Payment link sent for invoice #${invoice_id}`,
              JSON.stringify({ invoice_id, amount, payment_link: paymentLink.url })
            ]
          );
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      }

      // Send via SMS
      if ((send_via === 'sms' || send_via === 'both') && clientPhone) {
        const smsMessage = `Payment Request: Invoice #${invoice_id} for $${amount.toFixed(2)}. ${dueDateText}. Pay securely: ${paymentLink.url}`;

        const smsParams = {
          Message: smsMessage,
          PhoneNumber: clientPhone,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional'
            }
          }
        };

        try {
          await sns.publish(smsParams).promise();

          // Log notification
          await client.query(
            `INSERT INTO notification_log (client_id, type, channel, status, message, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              client_id,
              'payment_request',
              'sms',
              'sent',
              `Payment link sent for invoice #${invoice_id}`,
              JSON.stringify({ invoice_id, amount, payment_link: paymentLink.url })
            ]
          );
        } catch (smsError) {
          console.error('SMS send error:', smsError);
        }
      }

      return res.status(200).json({
        success: true,
        payment_link: paymentLink.url,
        payment_link_id: paymentLink.id,
        stripe_customer_id: stripeCustomerId,
        sent_via: send_via,
        message: 'Payment link created and sent to client'
      });
    }

    // Get payment link status
    else if (action === 'get_payment_status') {
      if (!invoice_id) {
        return res.status(400).json({ error: 'Missing invoice_id' });
      }

      // Get invoice with payment link
      const invoiceQuery = await client.query(
        'SELECT * FROM invoices WHERE id = $1',
        [invoice_id]
      );

      if (invoiceQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = invoiceQuery.rows[0];

      return res.status(200).json({
        invoice_id: invoice.id,
        payment_link: invoice.stripe_payment_link,
        payment_status: invoice.payment_status,
        amount: invoice.total_amount,
        created_at: invoice.stripe_payment_link_created_at
      });
    }

    // Invalid action
    else {
      return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('Stripe client billing error:', error);

    return res.status(500).json({
      error: 'Failed to process client billing',
      message: error.message
    });
  } finally {
    client.release();
  }
}
