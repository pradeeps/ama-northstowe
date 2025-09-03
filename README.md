# AMA Northstowe

A ChatGPT-style community assistant for Northstowe residents, powered by Perplexity AI.

## Features

- 🏘️ **Northstowe-focused**: Only answers questions related to Northstowe
- 🤖 **AI-powered**: Uses Perplexity AI for accurate, up-to-date information
- 🔒 **Secure**: API key protected on the backend
- ⚡ **Rate limited**: Prevents API abuse (5 requests per 5 minutes)
- 📱 **Mobile-friendly**: Responsive design works on all devices
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations

## Local Development

### Prerequisites

- Node.js 18+ 
- A Perplexity API key ([get one here](https://www.perplexity.ai/))

### Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

3. **Add your Perplexity API key to `.env.local`:**
```
PERPLEXITY_API_KEY=your_actual_api_key_here
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open [http://localhost:3000](http://localhost:3000)**

## Deployment to Railway

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/8B2oTL?referralCode=alphasec)

### Manual Deploy

1. **Create a Railway account at [railway.app](https://railway.app)**

2. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

3. **Login and initialize:**
```bash
railway login
railway init
```

4. **Add your environment variable:**
```bash
railway variables set PERPLEXITY_API_KEY=your_actual_api_key_here
```

5. **Deploy:**
```bash
railway up
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PERPLEXITY_API_KEY` | Your Perplexity API key | Yes |
| `NODE_ENV` | Set to `production` for deployment | No |

## Usage

### Sample Questions

- "When is the GP surgery opening?"
- "What are the upcoming town council meetings?"
- "Where is the nearest Tesco?"
- "When will the secondary school be ready?"
- "What bus services are available to Cambridge?"
- "Are there any community events this month?"

### Rate Limiting

- **Limit**: 5 requests per 5 minutes per user
- **Tracking**: By IP address
- **Reset**: Automatic after 5 minutes

## API Routes

### POST `/api/chat`

Send a message to the AI assistant.

**Request:**
```json
{
  "message": "When is the GP surgery opening?"
}
```

**Response:**
```json
{
  "response": "The Northstowe GP surgery is expected to open..."
}
```

**Error Response (Rate Limited):**
```json
{
  "error": "Too many requests. Please wait a moment before asking another question.",
  "rateLimited": true
}
```

**Error Response (Not Northstowe Related):**
```json
{
  "response": "I'm sorry, I can only answer questions related to Northstowe...",
  "notRelated": true
}
```

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI**: Perplexity AI API
- **Deployment**: Railway
- **HTTP Client**: Axios

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - feel free to use this for your community projects!

---

Built with ❤️ for the Northstowe community
