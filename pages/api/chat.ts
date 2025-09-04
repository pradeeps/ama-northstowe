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
    'police', 'fire service', 'emergency services',
    'unity centre', 'unity center', 'cabin', 'community hub',
    'cycle path', 'guided busway', 'phase', 'development',
    'bin collection', 'bins', 'rubbish', 'recycling', 'waste',
    'refuse', 'collection day', 'black bin', 'blue bin', 'green bin',
    'heron road', 'road', 'street', 'avenue', 'close', 'way'
  ];

  const followUpKeywords = [
    'when', 'where', 'how', 'what', 'who', 'why', 'which',
    'opening', 'available', 'cost', 'price', 'time', 'date',
    'contact', 'phone', 'email', 'address', 'location',
    'more information', 'details', 'update', 'status',
    'it', 'this', 'that', 'they', 'there', 'here',
    'also', 'additionally', 'furthermore', 'moreover',
    'nearest', 'closest', 'best', 'recommended'
  ];

  const lowerQuery = query.toLowerCase();
  
  // Always consider it related if it mentions Northstowe directly
  if (lowerQuery.includes('northstowe') || lowerQuery.includes('north stowe')) {
    return true;
  }

  // Check for specific Northstowe keywords
  if (northstoweKeywords.some(keyword => 
    lowerQuery.includes(keyword.toLowerCase())
  )) {
    return true;
  }

  // For very short questions or follow-up style questions, be more lenient
  if (query.trim().length <= 50 && followUpKeywords.some(keyword => 
    lowerQuery.includes(keyword.toLowerCase())
  )) {
    return true;
  }

  // If it's a question about opening times, locations, or services without specific mention
  // but in the context of a community assistant, assume it's local
  const localServicePatterns = [
    /when.*(open|close|available)/i,
    /where.*(is|are|can)/i,
    /how.*(get|reach|contact)/i,
    /what.*(time|day|hour)/i,
    /is.*(open|available|ready)/i,
    /are.*(there|any|open)/i
  ];
  
  if (localServicePatterns.some(pattern => pattern.test(query))) {
    return true;
  }

  return false;
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
        content: `You are a detailed local information assistant for Northstowe residents in South Cambridgeshire, UK. Provide specific, current, and actionable information that residents can immediately use.
        
        PRIORITY: Always search for and provide specific details like:
        - Exact dates, times, and schedules (e.g., "Friday collections", "next collection is Tuesday")
        - Specific addresses and locations
        - Current operational status and availability
        - Contact numbers, emails, and websites
        - Step-by-step instructions when relevant
        
        For bin collections: Focus on South Cambridgeshire District Council schedules, specific collection days, and current bin calendar information.
        
        For facilities/services: Provide opening hours, contact details, current status, and specific locations within Northstowe.
        
        For transport: Give specific route numbers, timetables, and stops.
        
        For developments: Include construction timelines, completion dates, and current progress.
        
        Always prioritize practical, immediately useful information over general guidance. If you find official schedules, calendars, or specific service details, present them clearly and prominently.
        
        Search focus areas:
        - South Cambridgeshire District Council services (bins, planning, housing)
        - Northstowe community facilities (Unity Centre, schools, healthcare)
        - Local transport (guided busway, buses, cycling)
        - Development updates (construction, infrastructure, amenities)
        - Town council meetings and community events`
      },
      {
        role: 'user',
        content: enhancedMessage
      }
    ];

    const response = await axios.post<PerplexityResponse>(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar',
        messages,
        max_tokens: 1200,
        temperature: 0,
        top_p: 0.8,
        return_citations: true,
        search_recency_filter: 'month',
        search_domain_filter: ['gov.uk', 'scambs.gov.uk', 'cambridge.gov.uk', 'southcambs.gov.uk', 'cambridgeshire.gov.uk']
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
