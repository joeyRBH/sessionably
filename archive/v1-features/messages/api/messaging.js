// Enhanced Messaging API
// Real-time-style messaging between clients and providers using smart polling

const { initDatabase, executeQuery } = require('./utils/database-connection');

// In-memory store for typing indicators (resets on server restart, which is fine)
const typingStatus = new Map(); // Format: "client_123" => { isTyping: true, timestamp: Date.now() }

// Helper function to verify session token
async function verifySession(sessionToken) {
  if (!sessionToken) return null;

  const result = await executeQuery(
    `SELECT cs.*, cu.client_id, cu.email, cu.id as user_id
     FROM client_sessions cs
     JOIN client_users cu ON cs.client_user_id = cu.id
     WHERE cs.session_token = $1
       AND cs.is_active = true
       AND cs.expires_at > CURRENT_TIMESTAMP`,
    [sessionToken]
  );

  return result.data.length > 0 ? result.data[0] : null;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDatabase();

    // Extract session token from header
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader ? authHeader.replace('Bearer ', '') : req.query.sessionToken || req.body?.sessionToken;

    // Verify session
    const session = await verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - invalid or expired session'
      });
    }

    const clientId = session.client_id;
    const userId = session.user_id;

    // Route to specific handlers based on URL path
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // GET /api/messaging/conversation - Get conversation messages
    if (req.method === 'GET' && pathname.includes('/conversation')) {
      return await getConversation(req, res, clientId);
    }

    // GET /api/messaging/poll - Poll for new messages (efficient polling)
    if (req.method === 'GET' && pathname.includes('/poll')) {
      return await pollMessages(req, res, clientId);
    }

    // POST /api/messaging/send - Send a message
    if (req.method === 'POST' && pathname.includes('/send')) {
      return await sendMessage(req, res, clientId, userId);
    }

    // POST /api/messaging/typing - Update typing status
    if (req.method === 'POST' && pathname.includes('/typing')) {
      return await updateTypingStatus(req, res, clientId);
    }

    // GET /api/messaging/typing - Get typing status
    if (req.method === 'GET' && pathname.includes('/typing')) {
      return await getTypingStatus(req, res, clientId);
    }

    // PUT /api/messaging/read - Mark messages as read
    if (req.method === 'PUT' && pathname.includes('/read')) {
      return await markAsRead(req, res, clientId);
    }

    // Default: return API info
    return res.status(200).json({
      success: true,
      message: 'Messaging API',
      endpoints: {
        'GET /api/messaging/conversation': 'Get conversation messages',
        'GET /api/messaging/poll': 'Poll for new messages (efficient)',
        'POST /api/messaging/send': 'Send a message',
        'POST /api/messaging/typing': 'Update typing status',
        'GET /api/messaging/typing': 'Get typing status',
        'PUT /api/messaging/read': 'Mark messages as read'
      }
    });

  } catch (error) {
    console.error('Messaging API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get conversation messages with pagination
 */
async function getConversation(req, res, clientId) {
  const { limit = 50, offset = 0, since } = req.query;

  // Build query with optional "since" filter for efficient polling
  let query = `
    SELECT
      id,
      client_id,
      subject,
      message,
      message_type,
      priority,
      is_read,
      read_at,
      sender_type,
      sender_id,
      sender_name,
      related_entity_type,
      related_entity_id,
      created_at,
      EXTRACT(EPOCH FROM created_at) as timestamp
    FROM client_messages
    WHERE client_id = $1
  `;
  const params = [clientId];
  let paramCount = 2;

  if (since) {
    query += ` AND created_at > to_timestamp($${paramCount})`;
    params.push(parseFloat(since));
    paramCount++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(parseInt(limit), parseInt(offset));

  const messagesResult = await executeQuery(query, params);

  // Get conversation stats
  const statsResult = await executeQuery(
    `SELECT
       COUNT(*) as total_messages,
       COUNT(CASE WHEN is_read = false AND sender_type = 'provider' THEN 1 END) as unread_count,
       MAX(created_at) as last_message_at
     FROM client_messages
     WHERE client_id = $1`,
    [clientId]
  );

  // Get client info
  const clientResult = await executeQuery(
    'SELECT id, name, email FROM clients WHERE id = $1',
    [clientId]
  );

  return res.status(200).json({
    success: true,
    data: {
      messages: messagesResult.data.reverse(), // Reverse so oldest is first
      conversation: {
        clientId: clientId,
        clientName: clientResult.data[0]?.name,
        clientEmail: clientResult.data[0]?.email,
        stats: statsResult.data[0]
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(statsResult.data[0]?.total_messages || 0)
      }
    },
    message: 'Conversation retrieved successfully'
  });
}

/**
 * Poll for new messages (efficient - only returns new messages since timestamp)
 */
async function pollMessages(req, res, clientId) {
  const { since, lastMessageId } = req.query;

  if (!since && !lastMessageId) {
    return res.status(400).json({
      success: false,
      error: 'Either "since" timestamp or "lastMessageId" is required'
    });
  }

  let query, params;

  if (lastMessageId) {
    // Get messages after a specific ID (more reliable)
    query = `
      SELECT
        id,
        client_id,
        subject,
        message,
        message_type,
        priority,
        is_read,
        read_at,
        sender_type,
        sender_id,
        sender_name,
        created_at,
        EXTRACT(EPOCH FROM created_at) as timestamp
      FROM client_messages
      WHERE client_id = $1 AND id > $2
      ORDER BY created_at ASC
      LIMIT 50
    `;
    params = [clientId, parseInt(lastMessageId)];
  } else {
    // Get messages since timestamp
    query = `
      SELECT
        id,
        client_id,
        subject,
        message,
        message_type,
        priority,
        is_read,
        read_at,
        sender_type,
        sender_id,
        sender_name,
        created_at,
        EXTRACT(EPOCH FROM created_at) as timestamp
      FROM client_messages
      WHERE client_id = $1 AND created_at > to_timestamp($2)
      ORDER BY created_at ASC
      LIMIT 50
    `;
    params = [clientId, parseFloat(since)];
  }

  const messagesResult = await executeQuery(query, params);

  // Get unread count
  const unreadResult = await executeQuery(
    `SELECT COUNT(*) as unread_count
     FROM client_messages
     WHERE client_id = $1 AND is_read = false AND sender_type = 'provider'`,
    [clientId]
  );

  return res.status(200).json({
    success: true,
    data: {
      newMessages: messagesResult.data,
      hasNewMessages: messagesResult.data.length > 0,
      unreadCount: parseInt(unreadResult.data[0]?.unread_count || 0),
      serverTime: Date.now() / 1000
    },
    message: messagesResult.data.length > 0 ? 'New messages available' : 'No new messages'
  });
}

/**
 * Send a message
 */
async function sendMessage(req, res, clientId, userId) {
  const { message, subject = 'Message' } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message content is required'
    });
  }

  // Get client name for sender
  const clientResult = await executeQuery(
    'SELECT name FROM clients WHERE id = $1',
    [clientId]
  );

  const clientName = clientResult.data[0]?.name || 'Client';

  // Create message
  const createResult = await executeQuery(
    `INSERT INTO client_messages
     (client_id, subject, message, message_type, priority, sender_type,
      sender_id, sender_name)
     VALUES ($1, $2, $3, 'chat', 'normal', 'client', $4, $5)
     RETURNING *,
       EXTRACT(EPOCH FROM created_at) as timestamp`,
    [clientId, subject, message.trim(), clientId, clientName]
  );

  // Clear typing status
  const typingKey = `client_${clientId}`;
  typingStatus.delete(typingKey);

  // Log audit event
  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  await executeQuery(
    `INSERT INTO audit_log
     (user_id, user_type, action, entity_type, entity_id, ip_address, user_agent)
     VALUES ($1, 'client', 'send_message', 'client_message', $2, $3, $4)`,
    [clientId, createResult.data[0].id, ipAddress, userAgent]
  );

  return res.status(201).json({
    success: true,
    data: createResult.data[0],
    message: 'Message sent successfully'
  });
}

/**
 * Update typing status
 */
async function updateTypingStatus(req, res, clientId) {
  const { isTyping } = req.body;

  const typingKey = `client_${clientId}`;

  if (isTyping) {
    typingStatus.set(typingKey, {
      isTyping: true,
      timestamp: Date.now(),
      clientId: clientId
    });

    // Auto-clear after 5 seconds
    setTimeout(() => {
      const current = typingStatus.get(typingKey);
      if (current && Date.now() - current.timestamp > 4500) {
        typingStatus.delete(typingKey);
      }
    }, 5000);
  } else {
    typingStatus.delete(typingKey);
  }

  return res.status(200).json({
    success: true,
    data: { isTyping: Boolean(isTyping) },
    message: 'Typing status updated'
  });
}

/**
 * Get typing status (for provider to see if client is typing)
 */
async function getTypingStatus(req, res, clientId) {
  const typingKey = `client_${clientId}`;
  const status = typingStatus.get(typingKey);

  // Check if status is stale (older than 5 seconds)
  const isStale = status && (Date.now() - status.timestamp > 5000);
  if (isStale) {
    typingStatus.delete(typingKey);
  }

  return res.status(200).json({
    success: true,
    data: {
      isTyping: !isStale && status?.isTyping === true,
      clientId: clientId
    }
  });
}

/**
 * Mark messages as read
 */
async function markAsRead(req, res, clientId) {
  const { messageIds, markAll = false } = req.body;

  if (markAll) {
    // Mark all messages from provider as read
    const updateResult = await executeQuery(
      `UPDATE client_messages
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE client_id = $1 AND is_read = false AND sender_type = 'provider'
       RETURNING id`,
      [clientId]
    );

    return res.status(200).json({
      success: true,
      data: {
        markedCount: updateResult.data.length,
        messageIds: updateResult.data.map(m => m.id)
      },
      message: `${updateResult.data.length} messages marked as read`
    });
  }

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'messageIds array is required, or set markAll=true'
    });
  }

  // Mark specific messages as read
  const placeholders = messageIds.map((_, i) => `$${i + 2}`).join(',');
  const updateResult = await executeQuery(
    `UPDATE client_messages
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE client_id = $1 AND id IN (${placeholders}) AND is_read = false
     RETURNING id`,
    [clientId, ...messageIds]
  );

  return res.status(200).json({
    success: true,
    data: {
      markedCount: updateResult.data.length,
      messageIds: updateResult.data.map(m => m.id)
    },
    message: `${updateResult.data.length} messages marked as read`
  });
}
