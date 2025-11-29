// Insurance Claims API Endpoint
// Manages insurance claims submission and tracking

const { initDatabase, executeQuery } = require('./utils/database-connection');
const { submitClaimToAvaility } = require('./utils/availity');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize database connection
    await initDatabase();

    // GET: Retrieve claims
    if (req.method === 'GET') {
      const { id, client_id, status } = req.query;

      if (id) {
        // Get single claim
        const result = await executeQuery(
          `SELECT ic.*,
                  c.first_name || ' ' || c.last_name as patient_name,
                  c.email as patient_email
           FROM insurance_claims ic
           LEFT JOIN clients c ON ic.client_id = c.id
           WHERE ic.id = $1`,
          [id]
        );

        if (result.data.length === 0) {
          return res.status(404).json({ error: 'Claim not found' });
        }

        return res.status(200).json(result.data[0]);
      } else {
        // Build query for multiple claims
        let query = `SELECT ic.*,
                            c.first_name || ' ' || c.last_name as patient_name
                     FROM insurance_claims ic
                     LEFT JOIN clients c ON ic.client_id = c.id
                     WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (client_id) {
          query += ` AND ic.client_id = $${paramCount++}`;
          params.push(client_id);
        }

        if (status) {
          query += ` AND ic.status = $${paramCount++}`;
          params.push(status);
        }

        query += ' ORDER BY ic.created_at DESC';

        const result = await executeQuery(query, params);

        return res.status(200).json(result.data || []);
      }
    }

    // POST: Create and submit claim
    if (req.method === 'POST') {
      const {
        patient_id,
        member_id,
        payer_id,
        service_date,
        cpt_code,
        diagnosis_code,
        amount,
        place_of_service
      } = req.body;

      if (!patient_id || !member_id || !payer_id || !service_date || !cpt_code || !diagnosis_code || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Generate claim number
      const claimNumber = 'CLM-' + Date.now() + '-' + Math.random().toString(36).substring(7).toUpperCase();

      // Insert claim into database
      const result = await executeQuery(
        `INSERT INTO insurance_claims (
          client_id, claim_number, member_id, payer_id, service_date,
          cpt_code, diagnosis_code, amount, place_of_service, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          patient_id, claimNumber, member_id, payer_id, service_date,
          cpt_code, diagnosis_code, amount, place_of_service || '11', 'pending'
        ]
      );

      const claim = result.data[0];

      // Try to submit to Availity (don't fail if it doesn't work)
      try {
        await submitClaimToAvaility(claim);

        // Update status to submitted
        await executeQuery(
          `UPDATE insurance_claims
           SET status = $1, submitted_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          ['submitted', claim.id]
        );

        claim.status = 'submitted';
      } catch (error) {
        console.error('Error submitting to Availity:', error);
        // Claim is still saved as pending even if submission fails
      }

      return res.status(201).json({
        success: true,
        data: claim,
        message: 'Claim created successfully'
      });
    }

    // PUT: Update claim status
    if (req.method === 'PUT') {
      const { id } = req.query;
      const { status, denial_reason, paid_amount } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Claim ID is required' });
      }

      const result = await executeQuery(
        `UPDATE insurance_claims
         SET status = COALESCE($1, status),
             denial_reason = COALESCE($2, denial_reason),
             paid_amount = COALESCE($3, paid_amount),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, denial_reason, paid_amount, id]
      );

      if (result.data.length === 0) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      return res.status(200).json({
        success: true,
        data: result.data[0],
        message: 'Claim updated successfully'
      });
    }

    // DELETE: Delete claim
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Claim ID is required' });
      }

      await executeQuery('DELETE FROM insurance_claims WHERE id = $1', [id]);

      return res.status(200).json({
        success: true,
        message: 'Claim deleted successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Insurance Claims API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
