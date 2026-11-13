import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { assembleChatbotContext } from '../services/chatbotContextService';
import {
  MessageSquare,
  X,
  Minimize2,
  Maximize2,
  Send,
  Sparkles,
  Bot,
  User,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  Lock,
  Mail,
  Zap,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  gmailDraft?: {
    to: string;
    subject: string;
    body: string;
  };
}

export const GeminiChatbotWidget: React.FC = () => {
  const { activeTab, language, settings, callAcademicApi } = useApp();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text:
        language === 'my'
          ? 'မင်္ဂလာပါ! ကျွန်တော်က **Akari AI Academic Mentor** ဖြစ်ပါတယ်။ UoPeople Scholarship, APA Citations, Course Registration နဲ့ အက်ဆေး ရေးသားမှုများအတွက် မည်သည့်အချိန်မဆို မေးမြန်းနိုင်ပါတယ်။'
          : 'Hello! I am your **Akari AI Academic Mentor**. How can I assist you with your University of the People studies, scholarship petitions, or essay humanization today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      const ctx = assembleChatbotContext(activeTab, language, user.email);
      
      const fullPrompt = `${ctx.systemContextPrompt}\n\nStudent Query: ${query}`;

      let aiResult = '';
      try {
        aiResult = await callAcademicApi('socratic_chat', {
          messages: [{ role: 'user', content: fullPrompt }],
        }, language);
      } catch (err: any) {
        if (err?.isQuotaExhausted || String(err?.message).includes('429') || String(err?.message).includes('quota')) {
          aiResult =
            language === 'my'
              ? '⚠️ **Gemini API Free Quota ပြည့်သွားပါပြီ။** Pacific Midnight အထိ ခေတ္တစောင့်ဆိုင်းပါ သို့မဟုတ် ကိုယ်ပိုင် API Key ထည့်သွင်းအသုံးပြုပါ။ (Offline Academic FAQ helper သို့ ပြောင်းလဲထားပါသည်)'
              : '⚠️ **Gemini API Free Quota exhausted.** Please wait until Pacific Midnight or enter your own custom API Key in settings.';
        } else {
          throw err;
        }
      }

      // Check if response contains an advisor email draft request
      let gmailDraft = undefined;
      if (query.toLowerCase().includes('advisor') || query.toLowerCase().includes('email') || query.toLowerCase().includes('scholarship')) {
        gmailDraft = {
          to: 'advisor@uopeople.edu',
          subject: 'Request for Program Advisor Authorization - Scholarship Renewal & Course Access',
          body: `Dear Program Advisor,\n\nI hope you are having a wonderful term. I am ${user.name || 'Student'} (ID: s123456), enrolled in the Bachelor of Science in Computer Science program at University of the People. I am writing to formally request your guidance and authorization to unlock my scholarship renewal form on the student portal.\n\nThank you for your continuous support.\n\nWarm regards,\n${user.name || 'Student Name'}`,
        };
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiResult || (language === 'my' ? 'ကျေးဇူးပြု၍ ထပ်မံမေးမြန်းပါ။' : 'Please try asking again.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        gmailDraft,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ Error: ${err?.message || 'Failed to generate response. Please check your API key.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenGmail = (draft: { to: string; subject: string; body: string }) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(draft.to)}&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.open(gmailUrl, '_blank');
  };

  const presetQuestions = [
    language === 'my' ? '💡 UoPeople Scholarship လျှောက်နည်း' : '💡 How to apply for UoPeople Scholarship',
    language === 'my' ? '📝 APA 7th စာကိုးရေးနည်း' : '📝 APA 7th citation formatting',
    language === 'my' ? '🛡️ ZeroGPT 0% ရောက်အောင် ဘယ်လိုပြင်မလဲ' : '🛡️ How to bypass ZeroGPT 0%',
    language === 'my' ? '✉️ Advisor ဆီ ပို့မယ့် ဂျီမေးလ် စာမူ' : '✉️ Draft Advisor Petition Email',
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Collapsed Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center space-x-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-indigo-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 text-white font-bold shadow-2xl shadow-pink-600/40 border border-pink-400/30 transition-all transform hover:scale-105 cursor-pointer"
        >
          <div className="relative">
            <Bot className="w-6 h-6 animate-pulse text-pink-200" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950" />
          </div>
          <span className="text-xs sm:text-sm tracking-wide hidden sm:inline">
            {language === 'my' ? 'Akari AI Mentor (မေးမြန်းရန်)' : 'Akari AI Mentor'}
          </span>
          {hasUnread && (
            <span className="absolute -top-2 -left-2 px-2 py-0.5 bg-rose-500 text-white font-mono text-[10px] rounded-full shadow animate-bounce">
              New
            </span>
          )}
        </button>
      )}

      {/* Expanded Chat Widget */}
      {isOpen && (
        <div
          className={`w-[92vw] sm:w-[420px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMinimized ? 'h-16' : 'h-[580px]'
          }`}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span>Akari AI Academic Mentor</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    Live
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {user.isLoggedIn ? `Connected: ${user.email}` : 'UoPeople Specialized AI'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm bg-slate-950/70">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} space-x-2`}>
                      {!isUser && (
                        <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div
                        className={`max-w-[82%] p-3.5 rounded-2xl leading-relaxed space-y-2 ${
                          isUser
                            ? 'bg-pink-600 text-white rounded-br-xs shadow-lg shadow-pink-600/20'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs shadow'
                        }`}
                      >
                        <p className="whitespace-pre-wrap font-sans text-xs">{msg.text}</p>

                        {/* Direct Gmail Action Integration */}
                        {msg.gmailDraft && (
                          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2 text-xs">
                            <div className="flex items-center space-x-1 font-bold text-emerald-300">
                              <Mail className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Ready-to-Send Advisor Email Draft</span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-mono bg-slate-950 p-2 rounded border border-slate-800">
                              <div><strong>To:</strong> {msg.gmailDraft.to}</div>
                              <div><strong>Subject:</strong> {msg.gmailDraft.subject}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenGmail(msg.gmailDraft!)}
                              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow transition-all cursor-pointer text-xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open in Gmail (Web / App)</span>
                            </button>
                          </div>
                        )}

                        <div
                          className={`text-[9px] text-right font-mono ${
                            isUser ? 'text-pink-200/70' : 'text-slate-500'
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>

                      {isUser && (
                        <div className="w-7 h-7 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-300 shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
                    <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    <span>Akari AI is reasoning & reviewing workspace context...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Preset Quick Questions */}
              <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
                {presetQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 whitespace-nowrap transition-all cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    language === 'my' ? 'မေးခွန်း (သို့မဟုတ်) အက်ဆေး တင်ပြရန်...' : 'Ask question or paste draft...'
                  }
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-sans"
                />
                <button
                  type="button"
                  disabled={!inputMessage.trim() || isLoading}
                  onClick={() => handleSendMessage()}
                  className="p-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white shadow-md shadow-pink-600/30 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
