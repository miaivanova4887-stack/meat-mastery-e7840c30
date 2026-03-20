import { ArrowLeft, Trash2, ShoppingBag as BagIcon, X, Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShoppingBag, convertUnit } from "@/contexts/ShoppingBagContext";
import { Button } from "@/components/ui/button";

const ShoppingBag = () => {
  const navigate = useNavigate();
  const { items, removeItem, clearBag, count, unitSystem, toggleUnitSystem, updateQuantity } = useShoppingBag();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <BagIcon size={20} className="text-primary" />
        <h1 className="text-lg font-display font-bold">Shopping list</h1>
        <span className="ml-auto text-xs text-muted-foreground">{count} item{count !== 1 ? "s" : ""}</span>
      </div>

      {/* Unit toggle */}
      {items.length > 0 && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-end gap-2">
          <span className="text-[11px] text-muted-foreground">Units:</span>
          <button
            onClick={toggleUnitSystem}
            className="flex rounded-lg overflow-hidden border border-border text-[11px] font-medium"
          >
            <span className={`px-3 py-1.5 transition-colors ${unitSystem === "imperial" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              oz / lb / tbsp
            </span>
            <span className={`px-3 py-1.5 transition-colors ${unitSystem === "metric" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              g / kg / ml
            </span>
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <BagIcon size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-display font-bold text-lg mb-1">Your shopping list is empty</p>
          <p className="text-sm text-muted-foreground/70 mb-6">Add ingredients from the Approved Ingredients list</p>
          <Button variant="outline" onClick={() => navigate("/ingredients")}>
            Browse Ingredients
          </Button>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {items.map((item) => {
            const display = convertUnit(item.quantity, item.unit, unitSystem);
            const showUnit = item.unit !== "piece";
            return (
              <div
                key={item.name}
                className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 animate-fade-in-up"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground block">{item.name}</span>
                  {showUnit && (
                    <span className="text-[11px] text-muted-foreground">
                      {display.quantity} {display.unit}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.name, item.quantity - (item.unit === "piece" ? 1 : item.quantity * 0.25))}
                      className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-medium text-foreground w-8 text-center">
                      {item.unit === "piece" ? item.quantity : display.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.name, item.quantity + (item.unit === "piece" ? 1 : item.quantity * 0.25))}
                      className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.name)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pt-4">
            <Button variant="destructive" className="w-full gap-2" onClick={clearBag}>
              <Trash2 size={16} />
              Clear Shopping List
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingBag;
