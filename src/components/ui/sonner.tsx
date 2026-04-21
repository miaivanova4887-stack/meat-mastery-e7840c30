import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      position="top-center"
      // Push toasts far enough below the top safe area to clear every
      // sticky page header in the app (Progress, HealthSync, Recipes, etc.)
      // on tall iPhones like the 17 Pro where the dynamic island + header
      // combine for ≈60 + 48 = 108px from the top edge. 6rem gives headroom.
      //
      // IMPORTANT: Sonner uses `mobileOffset` under `@media (max-width: 600px)`
      // (i.e. every phone). Without this, `offset` is ignored on iPhone and
      // toasts land on top of the Dynamic Island. Mirror the same value here.
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/10",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
