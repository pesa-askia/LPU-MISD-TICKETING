import { useChatbot } from "../hooks/useChatbot";
import { ChatbotContext } from "./chatbotContextValue";

export function ChatbotProvider({ children }) {
  const chatbot = useChatbot();
  return (
    <ChatbotContext.Provider value={chatbot}>
      {children}
    </ChatbotContext.Provider>
  );
}
