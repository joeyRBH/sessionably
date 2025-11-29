// Insurance Verification API Endpoint
// Manages eligibility and benefits verification

const { initDatabase, executeQuery } = require('./utils/database-connection');
const { verifyEligibility } = require('./utils/availity');

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

    // GET: Retrieve verifications
    if (req.method === 'GET') {
      const { id, client_id } = req.query;

      if (id) {
        // Get single verification
        const result = await executeQuery(
          `SELECT iv.*,
                  c.first_name || ' ' || c.last_name as patient_name
           FROM insurance_verifications iv
           LEFT JOIN clients c ON iv.client_id = c.id
           WHERE iv.id = $1`,
          [id]
        );

        if (result.data.length === 0) {
          return res.status(404).json({ error: 'Verification not found' });
        }

        return res.status(200).json(result.data[0]);
      } else {
        // Get all verifications
        let query = `SELECT iv.*,
                            c.first_name || ' ' || c.last_name as patient_name
                     FROM insurance_verifications iv
                     LEFT JOIN clients c ON iv.client_id = c.id
                     WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (client_id) {
          query += ` AND iv.client_id = $${paramCount++}`;
          params.push(client_id);
        }

        query += ' ORDER BY iv.created_at DESC';

        const result = await executeQuery(query, params);

        return res.status(200).json(result.data || []);
      }
    }

    // POST: Create verification request
    if (req.method === 'POST') {
      const path = req.url.split('?')[0];

      // Handle test connection endpoint
      if (path.includes('/test-connection')) {
        try {
          // Test Availity connection
          const testResult = await verifyEligibility({
            member_id: 'TEST123',
            payer_id: 'TEST',
            service_type: '30',
            test: true
          });

          return res.status(200).json({
            success: true,
            message: 'Connection successful',
            data: testResult
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Connection failed',
            details: error.message
          });
        }
      }

      // Normal verification request
      const {
        patient_id,
        member_id,
        payer_id,
        service_type
      } = req.body;

      if (!patient_id || !member_id || !payer_id) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get patient info
      const patientResult = await executeQuery(
        'SELECT first_name, last_name, email, date_of_birth FROM clients WHERE id = $1',
        [patient_id]
      );

      if (patientResult.data.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const patient = patientResult.data[0];
      const patientName = `${patient.first_name} ${patient.last_name}`;

      // Call Availity API for eligibility verification
      let verificationData = {
        status: 'active',
        deductible: 'N/A',
        deductible_met: 'N/A',
        copay: 'N/A',
        coinsurance: 'N/A',
        out_of_pocket_max: 'N/A'
      };

      try {
        const availityResult = await verifyEligibility({
          member_id,
          payer_id,
          service_type: service_type || '30',
          patient_first_name: patient.first_name,
          patient_last_name: patient.last_name,
          patient_dob: patient.date_of_birth
        });

        verificationData = {
          ...verificationData,
          ...availityResult
        };
      } catch (error) {
        console.error('Availity verification error:', error);
        // Continue with default data if API fails
      }

      // Store verification in database
      const result = await executeQuery(
        `INSERT INTO insurance_verifications (
          client_id, member_id, payer_id, payer_name, service_type,
          status, deductible, deductible_met, copay, coinsurance,
          out_of_pocket_max, response_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *`,
        [
          patient_id,
          member_id,
          payer_id,
          payer_id, // Use payer_id as payer_name for now
          service_type || '30',
          verificationData.status,
          verificationData.deductible,
          verificationData.deductible_met,
          verificationData.copay,
          verificationData.coinsurance,
          verificationData.out_of_pocket_max,
          JSON.stringify(verificationData)
        ]
      );

      const verification = result.data[0];

      return res.status(201).json({
        ...verification,
        patient_name: patientName
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Insurance Verification API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
