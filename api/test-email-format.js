// Test email format handling
module.exports = async (req, res) => {
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('📧 Test email format - Request body:', JSON.stringify(req.body, null, 2));
    
    // Handle both direct format and wrapped format
    let emailData;
    if (req.body.emailType && req.body.emailData) {
      // Wrapped format: { emailType: 'general', emailData: {...} }
      emailData = req.body.emailData;
      console.log('📧 Using wrapped format');
    } else {
      // Direct format: { to, subject, body, from }
      emailData = req.body;
      console.log('📧 Using direct format');
    }
    
    const { to, subject, body, htmlContent, textContent, from = 'noreply@sessionably.com' } = emailData;
    
    console.log('📧 Email data:', { to, subject, body: body?.substring(0, 50), htmlContent: htmlContent?.substring(0, 50), textContent: textContent?.substring(0, 50) });

    return res.status(200).json({
      success: true,
      message: 'Email format test successful',
      emailData: {
        to,
        subject,
        body: body?.substring(0, 50),
        htmlContent: htmlContent?.substring(0, 50),
        textContent: textContent?.substring(0, 50),
        from
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test email format error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};
