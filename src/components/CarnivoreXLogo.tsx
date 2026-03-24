const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const styles = {
    sm: "text-[0.85rem]",
    md: "text-[1.05rem]",
    lg: "text-[1.4rem]",
  };

  return (
    <span className={`inline-flex items-baseline leading-none select-none ${styles[size]} ${className}`}>
      <span className="font-light tracking-[0.12em] uppercase text-primary">
        Carnivore
      </span>
      <span className="font-bold tracking-tight text-primary/60 -ml-[0.05em]">
        X
      </span>
    </span>
  );
};

export default CarnivoreXLogo;
