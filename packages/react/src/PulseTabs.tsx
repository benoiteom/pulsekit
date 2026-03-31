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

function getTabFromUrl(defaultTab: string): string {
  if (typeof window === "undefined") return defaultTab;
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || defaultTab;
}

export function PulseTabs({ tabs, defaultTab, headerLeft }: PulseTabsProps) {
  const fallback = defaultTab || tabs[0]?.id || "traffic";
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl(fallback));

  // Sync with URL on popstate (browser back/forward)
  useEffect(() => {
    function onPopState() {
      setActiveTab(getTabFromUrl(fallback));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
