import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navigation = [
  { name: 'My orders', href: '/orders' },
  { name: 'Company orders', href: '/company-orders' },
  { name: 'Invoices', href: '/invoices' },
  { name: 'Addresses', href: '/addresses' },
  { name: 'User management', href: '/user-management' },
  { name: 'Account settings', href: '/account-settings' },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white border border-gray-200 shadow-sm"
        data-testid="mobile-menu-button"
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-44 md:flex-col md:fixed md:inset-y-0 md:top-16">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white border-r border-gray-200 h-full">
          <nav className="flex-1 px-2 space-y-0.5">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== '/orders' && location?.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "block px-4 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-black text-white font-medium"
                      : "text-black hover:bg-gray-100"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full pt-16 pb-4">
          <nav className="flex-1 px-2 space-y-0.5">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== '/orders' && location?.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-4 py-3 text-base transition-colors",
                    isActive
                      ? "bg-black text-white font-medium"
                      : "text-black hover:bg-gray-100"
                  )}
                  data-testid={`nav-mobile-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
