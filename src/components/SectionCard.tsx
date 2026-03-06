import { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const SectionCard = ({ title, children, className = "" }: SectionCardProps) => (
  <div className={`bg-card rounded-lg p-5 border border-border ${className}`}>
    <h2 className="text-lg font-display font-bold text-foreground mb-3">{title}</h2>
    {children}
  </div>
);

export default SectionCard;
