import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// Rate limiting storage (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // requests per window
const RATE_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

function getRateLimitKey(req: NextApiRequest): string {
  // Use IP address for rate limiting
  return req.headers['x-forwarded-for'] as string || 
         req.connection.remoteAddress || 
         'unknown';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(key);

  if (!userLimit) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  if (now > userLimit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return true;
  }

  userLimit.count++;
  return false;
}

function isNorthstoweRelated(query: string): boolean {
  const northstoweKeywords = [
    'northstowe', 'north stowe', 'cambridge', 'cambridgeshire',
    'town council', 'community', 'local', 'neighbourhood',
    'gp', 'doctor', 'surgery', 'medical', 'health',
    'school', 'education', 'primary school', 'secondary school',
    'transport', 'bus', 'train', 'cycling', 'walking',
    'shops', 'shopping', 'supermarket', 'tesco', 'pharmacy',
    'library', 'community centre', 'church', 'facilities',
    'housing', 'development', 'planning', 'construction',
    'park', 'green space', 'recreation', 'sport',
    'police', 'fire service', 'emergency services'
  ];

  const lowerQuery = query.toLowerCase();
  
  // Always consider it related if it mentions Northstowe directly
  if (lowerQuery.includes('northstowe') || lowerQuery.includes('north stowe')) {
    return true;
  }

  // Check for other relevant keywords
  return northstoweKeywords.some(keyword => 
    lowerQuery.includes(keyword.toLowerCase())
  );
}

function enhanceQueryForNorthstowe(query: string): string {
  // Add Northstowe context to help Perplexity understand the location
  const enhancedQuery = `${query} in Northstowe, Cambridgeshire, UK. Northstowe is a new town development in South Cambridgeshire.`;
  return enhancedQuery;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check rate limiting
  const rateLimitKey = getRateLimitKey(req);
  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({ 
      error: 'Too many requests. Please wait a moment before asking another question.',
      rateLimited: true
    });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Check if the query is related to Northstowe
  if (!isNorthstoweRelated(message)) {
    return res.status(200).json({
      response: "I'm sorry, I can only answer questions related to Northstowe. Please ask me about local services, facilities, developments, or community information in Northstowe.",
      notRelated: true
    });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const enhancedMessage = enhanceQueryForNorthstowe(message);
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant specifically for residents of Northstowe, a new town in Cambridgeshire, UK. 
        
        Provide accurate, helpful information about:
        - Local services (GP surgeries, schools, shops, transport)
        - Community events and town council meetings  
        - Development updates and planning
        - Local facilities and amenities
        - Transportation links to Cambridge and surrounding areas
        
        Always focus on Northstowe-specific information. If you don't have current information, suggest checking the official Northstowe website or town council for the most up-to-date details.
        
        Keep responses concise, friendly, and helpful for local residents.`
      },
      {
        role: 'user',
        content: enhancedMessage
      }
    ];

    const response = await axios.post<PerplexityResponse>(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-small-online',
        messages,
        max_tokens: 800,
        temperature: 0.2,
        top_p: 0.9,
        return_citations: false,
        search_domain_filter: ['gov.uk', 'cambridge.gov.uk', 'southcambs.gov.uk'],
        search_recency_filter: 'month'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content;
    
    if (!aiResponse) {
      return res.status(500).json({ error: 'No response from AI service' });
    }

    res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error('Perplexity API error:', error);
    console.error('API Key configured:', !!apiKey);
    console.error('API Key length:', apiKey?.length || 0);
    
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      
      if (error.response?.status === 401) {
        return res.status(500).json({ error: 'API authentication failed - check your Perplexity API key' });
      }
      if (error.response?.status === 429) {
        return res.status(429).json({ error: 'API rate limit exceeded. Please try again later.' });
      }
      if (error.response?.status === 403) {
        return res.status(500).json({ error: 'API access forbidden - check your Perplexity API key permissions' });
      }
    }

    res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
}
