import React, { useRef, useEffect, useState } from 'react';
import { Send, Sparkles, RotateCcw, Paperclip, FileText, X } from 'lucide-react';
import { ChatMessage, MessageRole, ContentType } from '../types';
import { SUGGESTION_CHIPS } from '../constants';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isTyping: boolean;
  onSendMessage: (text: string, fileContent?: string) => void;
  onSuggestionClick: (text: string) => void;
  onClearChat: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isTyping, onSendMessage, onSuggestionClick, onClearChat }) => {
  const [input, setInput] = React.useState('');
  const [file, setFile] = useState<{name: string, content: string} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() || file) {
      onSendMessage(input, file?.content);
      setInput('');
      setFile(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setFile({ name: selectedFile.name, content });
      };
      reader.readAsText(selectedFile);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      
      {/* Header */}
      <div className="h-10 border-b border-slate-100 flex items-center px-4 bg-slate-50 justify-between">
        <div className="flex items-center">
          <Sparkles className="w-4 h-4 text-blue-500 mr-2" />
          <span className="text-xs font-semibold text-slate-600">Process Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-slate-400">Powered by Gemini 2.5</div>
          <button 
            onClick={onClearChat}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Start New Chat"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm flex flex-col gap-2
              ${msg.role === MessageRole.USER 
                ? 'bg-slate-800 text-white rounded-br-none' 
                : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'}
            `}>
              {msg.attachedFileName && (
                <div className={`flex items-center gap-2 p-2 rounded ${msg.role === MessageRole.USER ? 'bg-slate-700/50' : 'bg-white border border-slate-200'}`}>
                  <FileText className="w-4 h-4 opacity-70" />
                  <span className="text-xs font-mono opacity-80">{msg.attachedFileName}</span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-200">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white">
        {/* Chips */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => onSuggestionClick(chip.prompt)}
              className="flex items-center whitespace-nowrap px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 hover:shadow-sm transition-all border border-blue-100"
            >
               {chip.label}
            </button>
          ))}
        </div>

        {/* File Preview */}
        {file && (
           <div className="mb-2 flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-lg w-fit">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-slate-700 max-w-[200px] truncate">{file.name}</span>
              <button onClick={() => setFile(null)} className="p-1 hover:bg-slate-200 rounded-full">
                <X className="w-3 h-3 text-slate-500" />
              </button>
           </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden"
            accept=".txt,.md,.json,.csv,.log"
            onChange={handleFileSelect}
          />
          
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isTyping}
              className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-24 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400`}
            />
            
            {/* Input Actions: Attach & Send */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                title="Attach Context (txt, md, json)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button 
                type="submit"
                disabled={(!input.trim() && !file) || isTyping}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;