/**
 * AI Note Generation API Endpoint
 * Generates clinical notes using Claude AI API
 *
 * This endpoint receives transcript data and uses Claude to generate
 * professional DAP (Data, Assessment, Plan) format clinical notes
 */

// Import required dependencies
const https = require('https');

/**
 * Main handler for Vercel serverless function
 */
module.exports = async (req, res) => {
  // Set CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    // Get API key from environment variables
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Claude API key is not configured. Please add ANTHROPIC_API_KEY to your environment variables.'
      });
    }

    // Parse request body
    const { transcript, clientName, sessionDate, sessionType, diagnosis } = req.body;

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Transcript is required and cannot be empty'
      });
    }

    // Prepare the prompt for Claude
    const prompt = `You are an experienced clinical psychologist creating a professional clinical note in DAP (Data, Assessment, Plan) format.

Session Details:
- Client: ${clientName || 'Client'}
- Date: ${sessionDate || new Date().toLocaleDateString()}
- Session Type: ${sessionType || 'Individual Therapy'}
${diagnosis ? `- Diagnosis: ${diagnosis}` : ''}

Session Transcript:
${transcript}

Please generate a comprehensive clinical note in DAP format with the following sections:

**DATA (Subjective & Objective Information):**
- Client's reported mood, thoughts, and concerns
- Observable behaviors and presentation
- Any relevant physical or environmental factors

**ASSESSMENT (Clinical Analysis):**
- Clinical impressions and formulation
- Progress toward treatment goals
- Risk assessment if applicable
- Themes and patterns observed

**PLAN (Treatment Plan & Next Steps):**
- Interventions used in this session
- Homework or between-session tasks
- Modifications to treatment plan if needed
- Next session plan and focus areas

Guidelines:
1. Use professional, clinical language
2. Be objective and factual
3. Avoid diagnostic conclusions unless clearly supported
4. Include specific examples from the session
5. Be concise but comprehensive
6. Maintain client confidentiality (use "client" rather than names in the note)
7. Focus on clinically relevant information

Generate the note now:`;

    // Make request to Claude API
    const noteContent = await generateNoteWithClaude(ANTHROPIC_API_KEY, prompt);

    // Return the generated note
    return res.status(200).json({
      success: true,
      note: noteContent,
      metadata: {
        generatedAt: new Date().toISOString(),
        clientName: clientName || 'Client',
        sessionDate: sessionDate || new Date().toLocaleDateString(),
        model: 'claude-sonnet-4-20250514'
      }
    });

  } catch (error) {
    console.error('Error generating note:', error);

    // Return detailed error information
    return res.status(500).json({
      error: 'Generation failed',
      message: error.message || 'Failed to generate clinical note. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Generate note content using Claude API
 */
function generateNoteWithClaude(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode !== 200) {
            console.error('Claude API error:', response);
            reject(new Error(response.error?.message || `API returned status ${res.statusCode}`));
            return;
          }

          if (!response.content || !response.content[0] || !response.content[0].text) {
            reject(new Error('Invalid response format from Claude API'));
            return;
          }

          resolve(response.content[0].text);
        } catch (parseError) {
          console.error('Error parsing Claude API response:', parseError);
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('HTTPS request error:', error);
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout - Claude API took too long to respond'));
    });

    // Set timeout to 30 seconds
    req.setTimeout(30000);

    // Write data to request body
    req.write(requestData);
    req.end();
  });
}
