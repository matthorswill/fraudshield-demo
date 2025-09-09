"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import PageTransition from '../components/PageTransition';

export default function Providers({ children }){
  const pathname = usePathname();
  // Load Bootstrap JS (parity with pages/_app)
  useEffect(() => { import('bootstrap/dist/js/bootstrap.bundle.min.js').catch(()=>{}); }, []);
  return (
    <PageTransition route={pathname}>
      {children}
    </PageTransition>
  );
}

