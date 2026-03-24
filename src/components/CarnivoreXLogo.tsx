const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const styles = {
    sm: "text-[14px]",
    md: "text-[1.1rem]",
    lg: "text-[1.6rem]",
  };

  return (
    <span className={`inline-flex items-baseline leading-none select-none tracking-[0.18em] uppercase ${styles[size]} ${className}`}>
      <span className="font-light text-foreground">Carnivore</span>
      <span className="font-black text-gradient-flame">X</span>
    </span>
  );
};

export default CarnivoreXLogo;
