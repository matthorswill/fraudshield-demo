"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Bell, BarChart3, Network, Landmark,
  CreditCard, Workflow, ShieldCheck, FileText, Settings,
  Bot, DatabaseZap, Link2, Users2, ClipboardList
} from "lucide-react";

type Item = { href: string; label: string; icon: any };

const navTop: Item[] = [
  { href: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/alerts",      label: "Alerts",      icon: Bell },
  { href: "/reports",     label: "Reports",     icon: BarChart3 },
  { href: "/entities",    label: "Entities",    icon: Users2 },
  { href: "/transactions",label: "Transactions",icon: CreditCard },
  { href: "/cases",       label: "Cases",       icon: ClipboardList },
];

const navMiddle: Item[] = [
  { href: "/rules",       label: "Rules",       icon: ShieldCheck },
  { href: "/models",      label: "Risk Models", icon: DatabaseZap },
  { href: "/connectors",  label: "Connectors",  icon: Link2 },
  { href: "/registry",    label: "Registry",    icon: Landmark },
  { href: "/graph",       label: "Graph",       icon: Network },
  { href: "/workflows",   label: "Workflows",   icon: Workflow },
];

const navBottom: Item[] = [
  { href: "/copilot",     label: "AI CoPilot",  icon: Bot },
  { href: "/logs",        label: "Audit",       icon: FileText },
  { href: "/settings",    label: "Settings",    icon: Settings },
];

export default function Sidebar() {
  const [pathname, setPathname] = useState<string>("/");
  useEffect(() => { try { setPathname(window.location.pathname || "/"); } catch {} }, []);
  return (
    <nav aria-label="Primary" className="fixed left-0 top-0 h-dvh w-[72px] bg-[#0B0F14] border-r border-white/10 flex flex-col z-40">
      <div className="px-3 py-4 text-sm font-semibold tracking-wide text-white">FraudShield</div>

      <ul className="mt-2 flex flex-col items-center gap-2">
        {navTop.map(it => (<NavItem key={it.href} {...it} active={pathname===it.href} />))}
      </ul>

      <div className="mt-4 mb-2 mx-3 border-t border-white/10" />

      <ul className="flex flex-col items-center gap-2">
        {navMiddle.map(it => (<NavItem key={it.href} {...it} active={pathname===it.href} />))}
      </ul>

      <div className="mt-auto mb-2 mx-3 border-t border-white/10" />

      <ul className="mb-3 flex flex-col items-center gap-2">
        {navBottom.map(it => (<NavItem key={it.href} {...it} active={pathname===it.href} />))}
      </ul>
    </nav>
  );
}

function NavItem({ href, label, icon: Icon, active }:{href:string; label:string; icon:any; active:boolean}){
  return (
    <li>
      <Link href={href} aria-label={label} aria-current={active? 'page': undefined}
        className={[
          "group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
          active
            ? "bg-indigo-600/15 text-indigo-400 ring-1 ring-indigo-500/20 shadow-[0_6px_24px_rgba(79,70,229,0.15)]"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        ].join(" ")}
      >
        <Icon size={22} className={active ? "scale-110 transition-transform" : "transition-transform group-hover:scale-105"} />
        <span role="tooltip" className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity absolute left-14 whitespace-nowrap rounded-lg bg-black/80 text-white text-xs px-2 py-1">
          {label}
        </span>
      </Link>
    </li>
  );
}

