'use client';

import { Nav } from '@/components/Nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="pt-14">{children}</div>
    </div>
  );
}
