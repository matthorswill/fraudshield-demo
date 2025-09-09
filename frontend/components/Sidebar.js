"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Bell, BarChart3, Network, Settings } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';

const items = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/alerts', label: 'Alerts', Icon: Bell },
  { href: '/reports', label: 'Reports', Icon: BarChart3 },
  { href: '/entities', label: 'Entities', Icon: Network },
  { href: '/transactions', label: 'Transactions', Icon: Network },
  { href: '/cases', label: 'Cases', Icon: Settings },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const [current, setCurrent] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const btnRefs = useRef([]);

  useEffect(() => {
    try {
      const path = window.location ? window.location.pathname : '';
      setCurrent(path);
      const idx = items.findIndex(i => i.href === path);
      if (idx >= 0) setFocusIndex(idx);
      const onPop = () => {
        try { const p = window.location.pathname; setCurrent(p); } catch {}
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    } catch {}
  }, []);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); const n=(focusIndex+1)%items.length; setFocusIndex(n); btnRefs.current[n]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const n=(focusIndex-1+items.length)%items.length; setFocusIndex(n); btnRefs.current[n]?.focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[focusIndex]; if (it) { try{ window.location.href = it.href; }catch{} } }
    else if (e.key === 'Escape') { try { (document.activeElement)?.blur(); } catch {} }
  }

  return (
    <Tooltip.Provider>
      <nav role="navigation" aria-label="Primary" className="fs-sidebar" onKeyDown={onKeyDown}>
        <Link className="fs-brand" href="/" aria-label="FraudShield">
          <span style={{fontSize:22}}>🥷</span>
        </Link>
        <div className="d-flex flex-column align-items-center w-100" style={{gap:10}}>
          {items.map((it, i) => {
            const active = current === it.href;
            const Icon = it.Icon;
            return (
              <Tooltip.Root key={it.href} delayDuration={150}>
                <Tooltip.Trigger asChild>
                  <Link
                    href={it.href}
                    aria-label={it.label}
                    className={`fs-nav-btn ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    title={it.label}
                    ref={el => (btnRefs.current[i] = el)}
                  >
                    <motion.span whileTap={{ scale: 0.98 }}>
                      <Icon size={22} />
                    </motion.span>
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content className="fs-tooltip" side="right">{it.label}</Tooltip.Content>
              </Tooltip.Root>
            );
          })}
        </div>
      </nav>
    </Tooltip.Provider>
  );
}
