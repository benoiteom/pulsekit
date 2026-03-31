"use client";

import React, { useState, useEffect } from "react";

export interface TabDefinition {
  id: string;
  label: string;
  content: React.ReactNode;
  actions?: React.ReactNode;
}

export interface PulseTabsProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  headerLeft?: React.ReactNode;
}

export function PulseTabs({ tabs, defaultTab, headerLeft }: PulseTabsProps) {
  const fallback = defaultTab || tabs[0]?.id || "traffic";
  const [activeTab, setActiveTab] = useState(fallback);

  // Sync with URL on mount and on popstate (browser back/forward)
  useEffect(() => {
    function syncTab() {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get("tab") || fallback);
    }
    syncTab();
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, [fallback]);

  function handleTabClick(tabId: string) {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.replaceState(null, "", url.toString());
  }

  const hasAnyActions = tabs.some((t) => t.actions);

  return (
    <div>
      <div className="pulse-dashboard-toolbar">
        {headerLeft}
        <nav className="pulse-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tab.id === activeTab}
              className={`pulse-tab${tab.id === activeTab ? " pulse-tab--active" : ""}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {hasAnyActions && (
          <div className="pulse-dashboard-actions">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{ display: tab.id === activeTab ? "contents" : "none" }}
              >
                {tab.actions}
              </div>
            ))}
          </div>
        )}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          className="pulse-tab-panel"
          style={{ display: tab.id === activeTab ? "block" : "none" }}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
