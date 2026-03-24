const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const styles = {
    sm: "text-[11px]",
    md: "text-[1.05rem]",
    lg: "text-[1.4rem]",
  };

  return (
    <span className={`inline-flex items-baseline leading-none select-none font-bold uppercase tracking-[0.2em] ${styles[size]} ${className}`}>
      <span className="text-primary">C</span>
      <span className="text-primary">arnivore</span>
      <span className="text-primary/60">X</span>
    </span>
  );
};

export default CarnivoreXLogo;
