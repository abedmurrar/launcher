"use client";

import { WsProvider } from "@/context/ws";
import { AppShell } from "@/components/launcher/AppShell";

export default function Home() {
  return (
    <WsProvider>
      <AppShell />
    </WsProvider>
  );
}
