import React from "react";

interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="pulse-card">
      <div className="pulse-card-header">
        <h2 className="pulse-card-title">{title}</h2>
      </div>
      <div className="pulse-card-body">{children}</div>
    </section>
  );
}
