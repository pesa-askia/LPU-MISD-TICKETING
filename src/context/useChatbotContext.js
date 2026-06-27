import { useContext } from "react";
import { ChatbotContext } from "./chatbotContextValue";

export function useChatbotContext() {
  const ctx = useContext(ChatbotContext);
  if (!ctx) {
    throw new Error("useChatbotContext must be used inside ChatbotProvider");
  }
  return ctx;
}
