import * as React from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAuth } from "@/lib/auth";
import {
  addScenario,
  buildSnapshot,
  listScenarios,
  MAX_SCENARIOS,
  updateScenario,
  type SavedScenario,
} from "@/lib/scenarios";
import type { CurrentInvestment, Finances, Home, Profile } from "@/lib/plan-schema";

interface Props {
  finances: Finances;
  investments: CurrentInvestment[];
  home: Home;
  profile: Profile;
  corpus?: SavedScenario["corpus"];
  loanRelief?: SavedScenario["loanRelief"];
  safetyAllocation?: number;
  // when set, indicates the user originally loaded from this scenario
  loadedFromId?: string;
  loadedFromName?: string;
  defaultName?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

export function SaveScenarioButton({
  finances,
  investments,
  home,
  profile,
  corpus,
  loanRelief,
  safetyAllocation,
  loadedFromId,
  loadedFromName,
  defaultName,
  variant = "default",
  size = "default",
  className,
  label = "Save This Scenario",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(defaultName ?? "");
  const [askMode, setAskMode] = React.useState(false);

  React.useEffect(() => {
    if (open) setName(defaultName ?? loadedFromName ?? "");
  }, [open, defaultName, loadedFromName]);

  const openSheet = () => {
    if (loadedFromId) {
      setAskMode(true);
      setOpen(true);
    } else {
      setAskMode(false);
      setOpen(true);
    }
  };

  const doSaveAsNew = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please give this scenario a name");
      return;
    }
    const list = listScenarios(user?.id);
    if (list.length >= MAX_SCENARIOS) {
      toast.error(
        `You've reached the maximum of ${MAX_SCENARIOS} scenarios. Delete one to save a new scenario.`,
      );
      return;
    }
    const snap = buildSnapshot({
      name: trimmed,
      finances,
      investments,
      home,
      profile,
      corpus,
      loanRelief,
    });
    const res = addScenario(user?.id, snap);
    if (!res.ok) {
      toast.error(
        `You've reached the maximum of ${MAX_SCENARIOS} scenarios. Delete one to save a new scenario.`,
      );
      return;
    }
    toast.success(`Scenario saved as "${trimmed}"`);
    setOpen(false);
  };

  const doUpdateExisting = () => {
    if (!loadedFromId) return;
    const snap = buildSnapshot({
      id: loadedFromId,
      name: loadedFromName || name.trim() || "Untitled scenario",
      finances,
      investments,
      home,
      profile,
      corpus,
      loanRelief,
    });
    updateScenario(user?.id, snap);
    toast.success(`Updated "${snap.name}"`);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={openSheet}
      >
        <Bookmark className="h-4 w-4" />
        {label}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>
              {askMode ? `Save "${loadedFromName ?? "Loaded scenario"}"` : "Save This Scenario"}
            </DrawerTitle>
            <DrawerDescription>
              {askMode
                ? "Update the loaded scenario or save your edits as a new one."
                : "Give this scenario a name so you can find and compare it later."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 px-4">
            <Label htmlFor="scenario-name">Scenario name</Label>
            <Input
              id="scenario-name"
              autoFocus
              placeholder='e.g. "Current Plan", "Higher Investment", "Wait 6 Months"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSaveAsNew();
              }}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              You can save up to {MAX_SCENARIOS} scenarios.
            </p>
          </div>

          <DrawerFooter className="gap-2">
            {askMode ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={doSaveAsNew} className="min-h-11 flex-1">
                  Save as new
                </Button>
                <Button onClick={doUpdateExisting} variant="secondary" className="min-h-11 flex-1">
                  Update existing
                </Button>
              </div>
            ) : (
              <Button onClick={doSaveAsNew} className="min-h-11">
                Save
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)} className="min-h-11">
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
