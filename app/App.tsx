"use client";

import { useCallback, useState } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { AgentKitPanel } from "@/components/AgentKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function App() {
  const { scheme, setScheme } = useColorScheme();
  const [activeTab, setActiveTab] = useState<"chat" | "agentkit">("chat");

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-end bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === "chat"
                ? "border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === "agentkit"
                ? "border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("agentkit")}
          >
            Agentkit
          </button>
        </div>

        <div className="pt-4">
          {activeTab === "chat" ? (
            <ChatKitPanel
              theme={scheme}
              onWidgetAction={handleWidgetAction}
              onResponseEnd={handleResponseEnd}
              onThemeRequest={setScheme}
            />
          ) : (
            <AgentKitPanel
              theme={scheme}
              onWidgetAction={handleWidgetAction}
              onResponseEnd={handleResponseEnd}
              onThemeRequest={setScheme}
            />
          )}
        </div>
      </div>
    </main>
  );
}
