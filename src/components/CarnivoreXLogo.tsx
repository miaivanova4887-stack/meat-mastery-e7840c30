const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const styles = {
    sm: "text-[13px]",
    md: "text-[1.05rem]",
    lg: "text-[1.4rem]",
  };

  return (
    <span className={`inline-flex items-baseline leading-none select-none font-bold tracking-[0.2em] ${styles[size]} ${className}`}>
      <span className="text-primary">Carnivore</span>
      <span className="text-primary">X</span>
    </span>
  );
};

export default CarnivoreXLogo;
