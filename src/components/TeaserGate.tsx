import { Lock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription, type SubscriptionTier } from "@/contexts/SubscriptionContext";
import { useState, type ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

interface TeaserGateProps {
  requiredTier: SubscriptionTier;
  featureName: string;
  children: ReactNode;
  /** "overlay" shows children greyed out; "block" replaces children entirely */
  mode?: "overlay" | "block";
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
};

const TIER_COLORS: Record<SubscriptionTier, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/15 text-primary",
  elite: "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))]",
};

const TeaserGate = ({ requiredTier, featureName, children, mode = "overlay" }: TeaserGateProps) => {
  const { hasAccess } = useSubscription();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  if (hasAccess(requiredTier)) {
    return <>{children}</>;
  }

  if (mode === "block") {
    return (
      <>
        <div
          className="relative rounded-xl border border-border/40 bg-card p-6 flex flex-col items-center gap-3 cursor-pointer"
          onClick={() => setDrawerOpen(true)}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Lock size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">{featureName}</p>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${TIER_COLORS[requiredTier]}`}>
            {TIER_LABELS[requiredTier]}
          </span>
          <p className="text-xs text-muted-foreground text-center">
            Unlock with {TIER_LABELS[requiredTier]} plan
          </p>
        </div>

        <UpgradeDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          requiredTier={requiredTier}
          featureName={featureName}
          navigate={navigate}
        />
      </>
    );
  }

  // overlay mode
  return (
    <>
      <div className="relative" onClick={() => setDrawerOpen(true)}>
        <div className="opacity-40 pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-9 h-9 rounded-full bg-background/90 border border-border flex items-center justify-center shadow-sm">
              <Lock size={14} className="text-muted-foreground" />
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TIER_COLORS[requiredTier]}`}>
              {TIER_LABELS[requiredTier]}
            </span>
          </div>
        </div>
      </div>

      <UpgradeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        requiredTier={requiredTier}
        featureName={featureName}
        navigate={navigate}
      />
    </>
  );
};

function UpgradeDrawer({
  open,
  onOpenChange,
  requiredTier,
  featureName,
  navigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredTier: SubscriptionTier;
  featureName: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Lock size={16} className="text-muted-foreground" />
            Unlock {featureName}
          </DrawerTitle>
          <DrawerDescription>
            This feature is available on the <strong>{TIER_LABELS[requiredTier]}</strong> plan. Upgrade to access {featureName.toLowerCase()} and more premium features.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="flex-row gap-3">
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">Maybe Later</Button>
          </DrawerClose>
          <Button
            className="flex-1 gap-2"
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
          >
            See Plans <ArrowRight size={14} />
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default TeaserGate;
