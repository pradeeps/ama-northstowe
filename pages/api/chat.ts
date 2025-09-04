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
  const lowerQuery = query.toLowerCase();
  
  // For meeting-related queries
  if (lowerQuery.includes('meeting') || lowerQuery.includes('council')) {
    const currentDate = new Date().toLocaleDateString('en-GB');
    return `site:northstowetowncouncil.gov.uk Northstowe Town Council meeting agenda September 2024 2025 "23 September" "23rd September" "September 23" next upcoming meeting after ${currentDate}`;
  }
  
  // For bin collection queries
  if (lowerQuery.includes('bin') || lowerQuery.includes('collection') || lowerQuery.includes('waste') || lowerQuery.includes('rubbish')) {
    return `${query} Northstowe bin collection schedule next Friday`;
  }
  
  // For transport queries
  if (lowerQuery.includes('bus') || lowerQuery.includes('transport') || lowerQuery.includes('travel')) {
    return `${query} Northstowe bus transport timetable route`;
  }
  
  // For facility/opening queries
  if (lowerQuery.includes('open') || lowerQuery.includes('centre') || lowerQuery.includes('center') || lowerQuery.includes('facility')) {
    return `${query} Northstowe opening times construction timeline`;
  }
  
  // Default enhancement
  return `${query} in Northstowe, Cambridgeshire, UK. Find specific current information, dates, times, schedules, contact details.`;
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
        content: `You are a detailed local information assistant for Northstowe residents in South Cambridgeshire, UK. Today's date is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

        CRITICAL REQUIREMENT: Find and provide SPECIFIC FUTURE dates, times, and details. Today is ${new Date().toLocaleDateString('en-GB')}. ONLY provide dates that are AFTER today. Do NOT refer people to documents or websites unless absolutely no specific information exists.

        SPECIAL SEARCH INSTRUCTIONS:
        For meeting dates: 
        1. Search the official Northstowe Town Council website first
        2. Look for specific agenda postings or meeting announcements with exact dates
        3. Do NOT assume meeting patterns (like "third Tuesday") - find the actual scheduled dates
        4. Prioritize official council announcements over inferred patterns
        5. If you find agenda documents, extract the specific meeting date from them
        
        If you find references to PDFs or schedules but can't access the content, search for:
        - Recent meeting minutes that mention the next meeting date
        - Community announcements about upcoming meetings
        - Social media posts from the council
        - Local news articles about council meetings
        - Resident forum discussions mentioning meeting dates

        EXAMPLES OF WHAT TO DO:
        ✓ "The next meeting is Tuesday, 23rd September 2025, 7-9pm" 
        ✗ "Check the meeting schedule PDF"
        
        ✓ "Next bin collection is Friday" 
        ✗ "Visit the council website for dates"
        
        ✓ "Unity Centre opens spring 2026, construction began March 2025" 
        ✗ "Opening date will be announced later"

        SEARCH STRATEGY:
        1. Search multiple sources: official sites, social media, community forums, local news
        2. Look for meeting announcements, not just schedule references
        3. Check recent meeting minutes for "next meeting" mentions
        4. Search for community discussions about upcoming events
        5. If no specific date found, search for patterns (e.g., "meetings held monthly on second Tuesday")

        RESPONSE FORMAT:
        - Lead with the specific answer if found
        - If no specific date available, provide the best available information about timing patterns
        - Only mention checking documents as a last resort`
      },
      {
        role: 'user',
        content: enhancedMessage
      }
    ];

    const response = await axios.post<PerplexityResponse>(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-reasoning',
        messages,
        max_tokens: 2000,
        temperature: 0,
        top_p: 0.8,
        return_citations: true,
        search_recency_filter: 'month'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
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
