import { ArrowLeft, Trash2, ShoppingBag as BagIcon, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShoppingBag } from "@/contexts/ShoppingBagContext";
import { Button } from "@/components/ui/button";

const ShoppingBag = () => {
  const navigate = useNavigate();
  const { items, removeItem, clearBag, count } = useShoppingBag();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <BagIcon size={20} className="text-primary" />
        <h1 className="text-lg font-display font-bold">Shopping Bag</h1>
        <span className="ml-auto text-xs text-muted-foreground">{count} item{count !== 1 ? "s" : ""}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <BagIcon size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-display font-bold text-lg mb-1">Your bag is empty</p>
          <p className="text-sm text-muted-foreground/70 mb-6">Add ingredients from the Approved Ingredients list</p>
          <Button variant="outline" onClick={() => navigate("/ingredients")}>
            Browse Ingredients
          </Button>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 animate-fade-in-up"
            >
              <span className="text-sm text-foreground">{item}</span>
              <button
                onClick={() => removeItem(item)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <div className="pt-4">
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={clearBag}
            >
              <Trash2 size={16} />
              Clear Bag
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingBag;
