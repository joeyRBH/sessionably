// Appointments API Endpoint
// Manages appointments with database integration

const { initDatabase, executeQuery, isDatabaseConnected } = require('./utils/database-connection');

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

    // GET: Retrieve appointments
    if (req.method === 'GET') {
      const { id, client_id } = req.query;

      if (id) {
        // Get single appointment
        const result = await executeQuery(
          `SELECT a.*, c.name as client_name 
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id
           WHERE a.id = $1`,
          [id]
        );

        if (result.data.length === 0) {
          return res.status(404).json({ error: 'Appointment not found' });
        }

        return res.status(200).json({
          success: true,
          data: result.data[0],
          message: 'Appointment retrieved successfully'
        });
      } else if (client_id) {
        // Get appointments for specific client
        const result = await executeQuery(
          `SELECT a.*, c.name as client_name 
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id
           WHERE a.client_id = $1
           ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
          [client_id]
        );

        return res.status(200).json({
          success: true,
          data: result.data,
          message: 'Appointments retrieved successfully'
        });
      } else {
        // Get all appointments
        const result = await executeQuery(
          `SELECT a.*, c.name as client_name 
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id
           ORDER BY a.appointment_date DESC, a.appointment_time DESC`
        );

        return res.status(200).json({
          success: true,
          data: result.data,
          message: 'Appointments retrieved successfully'
        });
      }
    }

    // POST: Create appointment
    if (req.method === 'POST') {
      const { client_id, appointment_date, appointment_time, duration, type, cpt_code, notes, status, modality, telehealth_room_id, telehealth_link } = req.body;

      if (!client_id || !appointment_date || !appointment_time) {
        return res.status(400).json({
          error: 'client_id, appointment_date, and appointment_time are required'
        });
      }

      const result = await executeQuery(
        `INSERT INTO appointments (client_id, appointment_date, appointment_time, duration, type, cpt_code, notes, status, modality, telehealth_room_id, telehealth_link, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          client_id,
          appointment_date,
          appointment_time,
          duration || 60,
          type || null,
          cpt_code || null,
          notes || null,
          status || 'scheduled',
          modality || 'in-person',
          telehealth_room_id || null,
          telehealth_link || null
        ]
      );

      if (!result.success || !result.data || result.data.length === 0) {
        return res.status(500).json({
          error: result.error || 'Failed to create appointment'
        });
      }

      return res.status(201).json({
        success: true,
        data: result.data[0],
        message: 'Appointment created successfully'
      });
    }

    // PUT: Update appointment
    if (req.method === 'PUT') {
      const { id, client_id, appointment_date, appointment_time, duration, type, cpt_code, notes, status, modality, telehealth_room_id, telehealth_link } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }

      const result = await executeQuery(
        `UPDATE appointments
         SET client_id = COALESCE($1, client_id),
             appointment_date = COALESCE($2, appointment_date),
             appointment_time = COALESCE($3, appointment_time),
             duration = COALESCE($4, duration),
             type = COALESCE($5, type),
             cpt_code = COALESCE($6, cpt_code),
             notes = COALESCE($7, notes),
             status = COALESCE($8, status),
             modality = COALESCE($9, modality),
             telehealth_room_id = COALESCE($10, telehealth_room_id),
             telehealth_link = COALESCE($11, telehealth_link),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12
         RETURNING *`,
        [
          client_id,
          appointment_date,
          appointment_time,
          duration,
          type,
          cpt_code,
          notes,
          status,
          modality,
          telehealth_room_id,
          telehealth_link,
          id
        ]
      );

      if (result.data.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.status(200).json({
        success: true,
        data: result.data[0],
        message: 'Appointment updated successfully'
      });
    }

    // DELETE: Delete appointment
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }

      const result = await executeQuery(
        'DELETE FROM appointments WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.data.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Appointment deleted successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Appointments API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}



