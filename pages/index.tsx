import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Clock, Sparkles } from 'lucide-react';
import axios from 'axios';
import Head from 'next/head';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isError?: boolean;
}

interface RateLimitInfo {
  isLimited: boolean;
  resetTime?: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({ isLimited: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sampleQuestions = [
    "When is the GP surgery opening?",
    "What are the upcoming town council meetings?",
    "Where is the nearest Tesco?",
    "When will the secondary school be ready?",
    "What bus services are available to Cambridge?",
    "Are there any community events this month?"
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message on component mount
    const welcomeMessage: Message = {
      id: '1',
      text: "Hello! Welcome to AMA Northstowe 👋\n\nI'm here to help you with questions about our community. You can ask me about local services, upcoming events, transport links, developments, and anything else related to life in Northstowe.\n\nTry asking something like \"When is the GP surgery opening?\" or click on one of the example questions below!",
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    if (rateLimitInfo.isLimited) {
      const now = Date.now();
      if (rateLimitInfo.resetTime && now < rateLimitInfo.resetTime) {
        const remainingTime = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
        const errorMessage: Message = {
          id: Date.now().toString(),
          text: `Please wait ${remainingTime} seconds before sending another message.`,
          isUser: false,
          timestamp: new Date(),
          isError: true,
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      } else {
        setRateLimitInfo({ isLimited: false });
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        message: textToSend,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.response,
        isUser: false,
        timestamp: new Date(),
        isError: response.data.notRelated || false,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      let errorText = 'Sorry, something went wrong. Please try again.';
      
      if (error.response?.status === 429) {
        errorText = error.response.data.error || 'Too many requests. Please wait before trying again.';
        if (error.response.data.rateLimited) {
          const resetTime = Date.now() + (5 * 60 * 1000); // 5 minutes from now
          setRateLimitInfo({ isLimited: true, resetTime });
        }
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        isUser: false,
        timestamp: new Date(),
        isError: true,
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSampleQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <>
      <Head>
        <title>AMA Northstowe - Your Local Community Assistant</title>
        <meta name="description" content="Ask questions about Northstowe - local services, events, transport, and community information." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="AMA Northstowe" />
        <meta property="og:description" content="Ask questions about Northstowe - local services, events, transport, and community information." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="AMA Northstowe" />
        <meta name="twitter:description" content="Ask questions about Northstowe - local services, events, transport, and community information." />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AMA Northstowe
              </h1>
              <p className="text-sm text-gray-600">Your local community assistant</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Messages Area */}
          <div className="h-[60vh] overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.isUser
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : message.isError
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  } shadow-sm`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.text}
                  </p>
                  <div className={`text-xs mt-2 opacity-70 ${message.isUser ? 'text-right' : 'text-left'}`}>
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="chat-message flex justify-start">
                <div className="bg-gray-100 p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="animate-typing">●</div>
                    <div className="animate-typing" style={{ animationDelay: '0.2s' }}>●</div>
                    <div className="animate-typing" style={{ animationDelay: '0.4s' }}>●</div>
                    <span className="ml-2 text-sm text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sample Questions */}
          {messages.length === 1 && !isLoading && (
            <div className="px-6 pb-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Try asking about:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSampleQuestion(question)}
                      className="text-left p-3 text-sm bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 transition-colors duration-200 hover:shadow-sm"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-6 border-t border-gray-100">
            {rateLimitInfo.isLimited && rateLimitInfo.resetTime && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">
                    Rate limit reached. Please wait before sending another message.
                  </span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about Northstowe..."
                className="flex-1 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white/80 backdrop-blur-sm"
                disabled={isLoading || rateLimitInfo.isLimited}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || rateLimitInfo.isLimited}
                className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>Powered by AI • For Northstowe residents</p>
        </div>
      </div>
      </div>
    </>
  );
}
