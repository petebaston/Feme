import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Home, Package, FileText, MoreHorizontal, MapPin, Users, Settings, ShoppingBag, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navigation = [
  { name: 'My Orders', href: '/my-orders' },
  { name: 'Company Orders', href: '/orders' },
  { name: 'Invoices', href: '/invoices' },
  { name: 'Addresses', href: '/addresses' },
  { name: 'User management', href: '/user-management' },
  { name: 'Account settings', href: '/account-settings' },
];

const bottomTabs = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Orders', href: '/orders', icon: Package },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'More', href: '#more', icon: MoreHorizontal },
];

const moreItems = [
  { name: 'My Orders', href: '/my-orders', icon: Package },
  { name: 'Addresses', href: '/addresses', icon: MapPin },
  { name: 'User Management', href: '/user-management', icon: Users },
  { name: 'Account Settings', href: '/account-settings', icon: Settings },
];

export default function Sidebar({ onLogout }: { onLogout?: () => void }) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isTabActive = (href: string) => {
    if (href === '/') return location === '/';
    if (href === '/orders') return location === '/orders' || location?.startsWith('/orders/');
    if (href === '/invoices') return location === '/invoices' || location?.startsWith('/invoices/');
    return false;
  };

  const isSidebarActive = (href: string) => {
    if (href === '/orders') return location === '/orders' || location?.startsWith('/orders/');
    return location === href || location?.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar — unchanged */}
      <div className="hidden md:flex md:w-44 md:flex-col md:fixed md:inset-y-0 md:top-16">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white border-r border-gray-200 h-full">
          <nav className="flex-1 px-2 space-y-0.5">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-4 py-2.5 text-sm transition-colors",
                  isSidebarActive(item.href)
                    ? "bg-black text-white font-medium"
                    : "text-black hover:bg-gray-100"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-stretch h-16">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            const isMore = tab.href === '#more';
            const active = isMore ? moreOpen : isTabActive(tab.href);

            if (isMore) {
              return (
                <button
                  key={tab.name}
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                    active ? "text-black" : "text-gray-400"
                  )}
                  data-testid="nav-mobile-more"
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                  active ? "text-black font-medium" : "text-gray-400"
                )}
                data-testid={`nav-mobile-${tab.name.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm transition-colors",
                    location === item.href || location?.startsWith(item.href)
                      ? "bg-gray-100 text-black font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                  data-testid={`nav-more-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}

            <div className="border-t border-gray-200 my-2" />

            <a
              href={(import.meta.env.VITE_STORE_URL || 'https://feme-limited-sandbox.mybigcommerce.com') + '/'}
              className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              data-testid="nav-more-shop"
            >
              <ShoppingBag className="w-5 h-5" />
              Shop
            </a>

            {onLogout && (
              <button
                onClick={() => { setMoreOpen(false); onLogout(); }}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full"
                data-testid="nav-more-logout"
              >
                <LogOut className="w-5 h-5" />
                Log out
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
