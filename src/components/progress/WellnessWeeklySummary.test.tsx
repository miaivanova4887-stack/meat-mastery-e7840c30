import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import WellnessCheckInDrawer from "./WellnessCheckInDrawer";
import { getGuestEntries } from "@/lib/guestProgress";
import { aggregateWeeklyProgress, nextMondayMorning } from "../../../supabase/functions/_shared/weeklyProgress";

beforeEach(() => localStorage.clear());
it("saving a four-rating guest check-in creates one weekly check-in, not four", async () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><WellnessCheckInDrawer open onOpenChange={() => {}} /></QueryClientProvider>);
  for (const label of ["Mood: Good", "Energy: High", "Sleep Quality: Good", "Mental Clarity: Clear"]) {
    fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Save Check-In", exact: true }));
  await waitFor(() => expect(getGuestEntries()).toHaveLength(4));
  const now = new Date();
  const anchor = nextMondayMorning(now, "America/Toronto");
  expect(aggregateWeeklyProgress(getGuestEntries(), null, anchor, "America/Toronto", now).checkIns).toBe(1);
  expect(new Set(getGuestEntries().map(e => e.recorded_at)).size).toBe(1);
});