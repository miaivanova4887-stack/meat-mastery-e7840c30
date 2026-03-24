import logoImg from "@/assets/logo-carnivorex.png";

const CarnivoreXLogo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const heights = { sm: 24, md: 32, lg: 44 };

  return (
    <img
      src={logoImg}
      alt="CarnivoreX"
      height={heights[size]}
      className={`h-[${heights[size]}px] w-auto ${className}`}
      style={{ height: heights[size], width: "auto" }}
    />
  );
};

export default CarnivoreXLogo;
