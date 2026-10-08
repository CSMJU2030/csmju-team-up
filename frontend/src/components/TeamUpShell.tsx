"use client";

import { useEffect, useMemo, useState } from "react";
import { CsmjuAppShell, type NavItem } from "@/csmju";
import { api } from "./api";
import type { Me } from "./api";

function initials(id: string | undefined) {
  if (!id) return "CT";
  const compact = id.replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(-2) || "CT").toUpperCase();
}

function roleLabel(role: string | undefined) {
  return role === "student" ? "นักศึกษา" : role === "lecturer" ? "อาจารย์" : role === "staff" ? "บุคลากร" : role === "admin" ? "ผู้ดูแลระบบ" : "บัญชี CSMJU";
}

export default function TeamUpShell({ nav, coreHubWebUrl, children }: { nav: NavItem[]; coreHubWebUrl?: string; children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { void api<Me>("/api/v1/me").then(setMe).catch(() => undefined); }, []);
  const user = useMemo(() => ({ initials: initials(me?.coreUserId), roleLabel: roleLabel(me?.coreRole) }), [me]);
  return (
    <CsmjuAppShell
      displayName="CS TeamUp"
      nav={nav}
      primaryAction={{ label: "สร้างโปรเจกต์", href: "/?action=create" }}
      user={user}
      coreHubUrl={coreHubWebUrl}
    >
      {children}
    </CsmjuAppShell>
  );
}
