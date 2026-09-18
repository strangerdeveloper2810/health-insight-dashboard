import { useState } from "react";
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export const Tabs = ({ tabs }: { tabs: TabItem[] }) => {
  const [activeTab, setActiveTab] = useState(tabs[0]!.id);

  return (
    <div className="space-y-6">
      <div className="flex space-x-1 rounded-xl bg-sunken p-1 sm:w-fit overflow-x-auto scroll-slim">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              whitespace-nowrap rounded-lg px-4 py-2 text-[0.875rem] font-medium transition-all duration-200
              ${
                activeTab === tab.id
                  ? "bg-surface text-ink shadow-card"
                  : "text-muted hover:bg-surface/50 hover:text-ink"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="animate-fade">
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </div>
  );
};
