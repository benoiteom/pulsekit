import React from "react";

interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section
      className="rounded-lg overflow-hidden shadow-sm"
      style={{
        border: "1px solid var(--pulse-border)",
        backgroundColor: "var(--pulse-bg)",
      }}
    >
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--pulse-border)" }}
      >
        <h2
          className="text-base font-semibold m-0"
          style={{ color: "var(--pulse-fg)" }}
        >
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
