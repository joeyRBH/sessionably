const { initDatabase, getSqlClient } = require('./utils/database-connection');
// Payment Reports API Endpoint for Vercel
// Generates payment history reports and analytics

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Generate payment reports
    if (req.method === 'GET') {
      const {
        start_date,
        end_date,
        client_id,
        status,
        include_summary = 'true'
      } = req.query;

      await initDatabase();
      const sql = getSqlClient();

      try {
        // Build WHERE clause
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (start_date) {
          whereConditions.push(`pt.created_at >= $${paramIndex}`);
          params.push(start_date);
          paramIndex++;
        }

        if (end_date) {
          whereConditions.push(`pt.created_at <= $${paramIndex}`);
          params.push(end_date);
          paramIndex++;
        }

        if (client_id) {
          whereConditions.push(`pt.client_id = $${paramIndex}`);
          params.push(client_id);
          paramIndex++;
        }

        if (status) {
          whereConditions.push(`pt.status = $${paramIndex}`);
          params.push(status);
          paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
          ? 'WHERE ' + whereConditions.join(' AND ')
          : '';

        // Get transactions
        const transactionsQuery = `
          SELECT 
            pt.id,
            pt.invoice_id,
            pt.client_id,
            c.name as client_name,
            pt.amount,
            pt.type,
            pt.status,
            pt.refund_amount,
            pt.refund_reason,
            pt.created_at,
            pm.last4,
            pm.brand,
            i.invoice_number
          FROM payment_transactions pt
          LEFT JOIN clients c ON pt.client_id = c.id
          LEFT JOIN payment_methods pm ON pt.payment_method_id = pm.id
          LEFT JOIN invoices i ON pt.invoice_id = i.id
          ${whereClause}
          ORDER BY pt.created_at DESC
        `;

        const transactionsResult = await sql.unsafe(transactionsQuery, params);

        let summary = null;

        if (include_summary === 'true') {
          // Get summary statistics
          const summaryQuery = `
            SELECT
              COALESCE(SUM(CASE WHEN pt.type = 'payment' AND pt.status = 'succeeded' THEN pt.amount ELSE 0 END), 0) as total_revenue,
              COALESCE(SUM(CASE WHEN pt.type = 'refund' THEN pt.refund_amount ELSE 0 END), 0) as total_refunds,
              COALESCE(COUNT(CASE WHEN pt.type = 'payment' AND pt.status = 'succeeded' THEN 1 END), 0) as successful_payments,
              COALESCE(COUNT(CASE WHEN pt.type = 'payment' THEN 1 END), 0) as total_payment_attempts
            FROM payment_transactions pt
            ${whereClause}
          `;

          const summaryResult = await sql.unsafe(summaryQuery, params);
          const summaryData = summaryResult[0];

          // Get outstanding invoices
          const outstandingQuery = `
            SELECT COALESCE(SUM(total_amount - COALESCE(refund_amount, 0)), 0) as outstanding
            FROM invoices
            WHERE status IN ('pending', 'overdue')
            ${client_id ? `AND client_id = $${paramIndex}` : ''}
          `;

          const outstandingParams = client_id ? [...params, client_id] : params;
          const outstandingResult = await sql.unsafe(outstandingQuery, outstandingParams);

          const collectionRate = summaryData.total_payment_attempts > 0
            ? (summaryData.successful_payments / summaryData.total_payment_attempts) * 100
            : 0;

          summary = {
            total_revenue: parseFloat(summaryData.total_revenue),
            outstanding: parseFloat(outstandingResult[0].outstanding),
            refunds: parseFloat(summaryData.total_refunds),
            collection_rate: Math.round(collectionRate * 100) / 100,
            successful_payments: parseInt(summaryData.successful_payments),
            total_payment_attempts: parseInt(summaryData.total_payment_attempts)
          };
        }

        // Get payment method breakdown
        const methodBreakdownQuery = `
          SELECT
            pm.brand,
            pm.type,
            COUNT(*) as count,
            SUM(pt.amount) as total
          FROM payment_transactions pt
          LEFT JOIN payment_methods pm ON pt.payment_method_id = pm.id
          ${whereClause}
          AND pt.type = 'payment'
          AND pt.status = 'succeeded'
          GROUP BY pm.brand, pm.type
          ORDER BY total DESC
        `;

        const methodBreakdownResult = await sql.unsafe(methodBreakdownQuery, params);

        return res.status(200).json({
          success: true,
          data: {
            transactions: transactionsResult,
            summary: summary,
            payment_method_breakdown: methodBreakdownResult
          },
          message: 'Report generated successfully'
        });

      } catch (error) {
        throw error;
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Payment reports API error:', error);
    return res.status(500).json({ 
      error: 'Report generation failed',
      message: error.message 
    });
  }
}

