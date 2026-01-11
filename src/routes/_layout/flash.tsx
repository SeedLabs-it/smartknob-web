import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAppModeStore } from "@/stores/appModeStore";

export const Route = createFileRoute("/_layout/flash")({
  component: FlashRoute,
});

function FlashRoute() {
  const { setMode } = useAppModeStore();

  useEffect(() => {
    setMode("firmware");
  }, [setMode]);

  return null;
}
