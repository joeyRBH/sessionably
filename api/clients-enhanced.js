// Enhanced Client Management with Search and Tags
// POST /api/clients-enhanced (create), GET (search), PUT (update), DELETE

const { initDatabase, executeQuery } = require('./utils/database-connection');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDatabase();

    // GET: Search clients with full-text search
    if (req.method === 'GET') {
      const { q, status, tag, limit = 50 } = req.query;

      let query = 'SELECT * FROM clients_v2 WHERE 1=1';
      const params = [];
      let paramCount = 0;

      // Full-text search
      if (q) {
        paramCount++;
        query += ` AND to_tsvector('english', name || ' ' || COALESCE(notes, '')) @@ plainto_tsquery('english', $${paramCount})`;
        params.push(q);
      }

      // Filter by status
      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      // Filter by tag
      if (tag) {
        paramCount++;
        query += ` AND $${paramCount} = ANY(tags)`;
        params.push(tag);
      }

      paramCount++;
      query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
      params.push(limit);

      const result = await executeQuery(query, params);

      return res.status(200).json({
        success: true,
        data: result.data,
        count: result.data.length
      });
    }

    // POST: Create new client
    if (req.method === 'POST') {
      const { name, email, phone, status = 'active', tags = [], notes } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email required' });
      }

      const result = await executeQuery(
        `INSERT INTO clients_v2 (name, email, phone, status, tags, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, email, phone, status, tags, notes]
      );

      return res.status(201).json({
        success: true,
        data: result.data[0]
      });
    }

    // PUT: Update client
    if (req.method === 'PUT') {
      const { id, name, email, phone, status, tags, notes } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID required' });
      }

      const result = await executeQuery(
        `UPDATE clients_v2
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             phone = COALESCE($3, phone),
             status = COALESCE($4, status),
             tags = COALESCE($5, tags),
             notes = COALESCE($6, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [name, email, phone, status, tags, notes, id]
      );

      if (result.data.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      return res.status(200).json({
        success: true,
        data: result.data[0]
      });
    }

    // DELETE: Remove client
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID required' });
      }

      await executeQuery('DELETE FROM clients_v2 WHERE id = $1', [id]);

      return res.status(200).json({
        success: true,
        message: 'Client deleted'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Enhanced clients error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}
