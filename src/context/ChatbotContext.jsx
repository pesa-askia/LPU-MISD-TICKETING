import { createContext, useContext } from "react";
import { useChatbot } from "../hooks/useChatbot";

const ChatbotContext = createContext(null);

export function ChatbotProvider({ children }) {
  const chatbot = useChatbot();
  return (
    <ChatbotContext.Provider value={chatbot}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbotContext() {
  const ctx = useContext(ChatbotContext);
  if (!ctx) throw new Error("useChatbotContext must be used inside ChatbotProvider");
  return ctx;
}
