const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const styles = {
    sm: "text-sm",
    md: "text-[12px]",
    lg: "text-[14px]",
  };

  return (
    <span className={`inline-flex items-baseline leading-none select-none tracking-[0.3em] uppercase font-extrabold logo-wordmark ${styles[size]} ${className}`}>
      <span>Carnivore</span>
      <span className="text-primary">X</span>
    </span>
  );
};

export default CarnivoreXLogo;
