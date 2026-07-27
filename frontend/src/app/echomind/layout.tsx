import Link from 'next/link';
import { LayoutDashboard, MessageSquare, Key } from 'lucide-react';
import { ReactNode } from 'react';

export default function EchoMindLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-void text-paper">
      <aside className="w-64 border-r border-edge bg-void-surface p-4 flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-signal p-2 rounded-xl"><span className="font-bold text-xl text-paper tracking-tighter">EM</span></div>
          <h1 className="text-xl font-bold tracking-tight">EchoMind</h1>
        </div>
        <nav className="flex flex-col gap-2 mt-4">
          <Link href="/echomind/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-void-raised transition-colors text-paper-muted hover:text-paper motion-reduce:transition-none"><LayoutDashboard size={20} /><span className="font-medium">Dashboard</span></Link>
          <Link href="/echomind/mentions" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-void-raised transition-colors text-paper-muted hover:text-paper motion-reduce:transition-none"><MessageSquare size={20} /><span className="font-medium">Mentions Feed</span></Link>
          <Link href="/echomind/keywords" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-void-raised transition-colors text-paper-muted hover:text-paper motion-reduce:transition-none"><Key size={20} /><span className="font-medium">Keywords</span></Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-void"><div className="max-w-7xl mx-auto p-8">{children}</div></main>
    </div>
  );
}
