const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: { height: 28, fontSize: "text-[1.4rem]" },
    md: { height: 36, fontSize: "text-[1.7rem]" },
    lg: { height: 48, fontSize: "text-[2.2rem]" },
  };

  const s = sizes[size];

  return (
    <span className={`inline-flex items-baseline gap-0 leading-none select-none ${className}`}>
      <span className={`${s.fontSize} font-medium tracking-[-0.02em] text-primary`}>
        Carnivore
      </span>
      {/* X with integrated fang/flame */}
      <svg
        viewBox="0 0 32 38"
        height={s.height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block -ml-0.5"
        aria-hidden="true"
      >
        {/* Main X strokes */}
        <path
          d="M4 4L16 20L28 4"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 34L16 20L28 34"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Small flame accent on top-right of X */}
        <path
          d="M26 4C26 4 29 0 28 -2C27 0 25.5 1.5 26 4Z"
          fill="hsl(var(--primary))"
          opacity="0.7"
        />
        {/* Fang accent — small sharp triangle at bottom center */}
        <path
          d="M14.5 34L16 38L17.5 34"
          fill="hsl(var(--primary))"
          opacity="0.8"
        />
      </svg>
    </span>
  );
};

export default CarnivoreXLogo;
