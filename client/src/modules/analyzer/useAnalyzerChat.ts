import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolResults?: any[];
}

export function useAnalyzerChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const idCounter = useRef(0);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${++idCounter.current}`,
      role: 'user',
      text,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build messages payload for the server
      const allMessages = [...messages, userMsg].map(m => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text', text: m.text }],
      }));

      const res = await fetch('/api/analyzer/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let toolResults: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text' && parsed.text) {
              assistantText += parsed.text;
            } else if (parsed.type === 'tool-invocation' && parsed.result) {
              toolResults.push(parsed);
            } else if (parsed.type === 'error' && parsed.errorText) {
              assistantText += `Error: ${parsed.errorText}`;
            }
          } catch {}
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${++idCounter.current}`,
        role: 'assistant',
        text: assistantText,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${++idCounter.current}`,
        role: 'assistant',
        text: `Error: ${err.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  return { messages, sendMessage, isLoading };
}
