import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Test different model names
  const modelsToTest = [
    'sonar',
    'sonar-small-online',
    'sonar-medium-online',
    'sonar-small-chat',
    'llama-3.1-sonar-small-128k-online',
    'pplx-7b-online',
    'pplx-70b-online'
  ];

  const results = [];

  for (const model of modelsToTest) {
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model,
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message.'
            }
          ],
          max_tokens: 50
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      results.push({
        model,
        status: 'success',
        response: response.data.choices[0]?.message?.content || 'No content'
      });
      
      // Stop after first successful model
      break;
      
    } catch (error: any) {
      results.push({
        model,
        status: 'failed',
        error: error.response?.data?.error || error.message
      });
    }
  }

  res.status(200).json({
    apiKeyConfigured: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    results
  });
}
