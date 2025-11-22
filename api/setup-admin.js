// Setup Admin User API Endpoint
// Creates the default admin user if it doesn't exist

const { initDatabase, executeQuery } = require('./utils/database-connection');
const crypto = require('crypto');

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
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Initialize database connection
        const dbConnected = await initDatabase();
        
        if (!dbConnected) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected. Please set DATABASE_URL environment variable.'
            });
        }

        // Check if admin user already exists
        const checkResult = await executeQuery(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );

        if (!checkResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Database error: ' + checkResult.error
            });
        }

        if (checkResult.data.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'Admin user already exists',
                user_id: checkResult.data[0].id
            });
        }

        // Create admin user
        const defaultPassword = 'admin123';
        // Simple hash for demo - in production use bcrypt
        const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');

        const insertResult = await executeQuery(
            `INSERT INTO users (username, password_hash, name, email, role) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, username, name, role`,
            ['admin', passwordHash, 'Admin User', 'admin@sessionably.com', 'admin']
        );

        if (!insertResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to create admin user: ' + insertResult.error
            });
        }

        console.log('✅ Admin user created successfully');

        return res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            user: {
                id: insertResult.data[0].id,
                username: insertResult.data[0].username,
                name: insertResult.data[0].name,
                role: insertResult.data[0].role
            },
            credentials: {
                username: 'admin',
                password: 'admin123'
            },
            warning: '⚠️ Please change the default password after first login!'
        });

    } catch (error) {
        console.error('Setup admin error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

