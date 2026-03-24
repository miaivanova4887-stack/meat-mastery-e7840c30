import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      position="top-center"
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground group-[.toaster]:border-primary/30 group-[.toaster]:shadow-lg group-[.toaster]:shadow-primary/20",
          description: "group-[.toast]:text-primary-foreground/80",
          actionButton: "group-[.toast]:bg-primary-foreground group-[.toast]:text-primary",
          cancelButton: "group-[.toast]:bg-primary-foreground/20 group-[.toast]:text-primary-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
