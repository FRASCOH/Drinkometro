'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/home', icon: '🏠', label: 'Home' },
    { href: '/dashboard', icon: '📊', label: 'Stats' },
    { href: '/friends', icon: '👥', label: 'Amici' },
    { href: '/clubs', icon: '🏆', label: 'Club' },
    { href: '/profile', icon: '👤', label: 'Profilo' },
  ];

  return (
    <>
      <div className="app-container">
        {children}
      </div>

      {/* FAB - Add Drink */}
      <Link href="/add-drink" className="fab" aria-label="Aggiungi drink">
        +
      </Link>

      {/* Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Navigazione principale">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${pathname === item.href || pathname?.startsWith(item.href + '/') ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
