import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown } from "lucide-react";
import femeLogo from "@assets/feme-logo.png";

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0].toUpperCase();
}

export default function Header({ onLogout }: { onLogout?: () => void }) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('b2b_user') || '{}');

  const handleHomeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setSsoLoading(true);
    try {
      const token = localStorage.getItem('b2b_token');
      const response = await fetch('/api/auth/sso-url?redirect_to=/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.url) {
          window.top ? window.top.location.href = data.url : window.location.href = data.url;
        } else {
          window.top ? window.top.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/' : window.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/';
        }
      } else {
        window.top ? window.top.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/' : window.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/';
      }
    } catch (err) {
      console.error('SSO redirect error:', err);
      window.top ? window.top.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/' : window.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/';
    } finally {
      setSsoLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('b2b_token');

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      localStorage.removeItem('b2b_token');
      localStorage.removeItem('user');
      localStorage.removeItem('b2b_user');

      const logoutImg = new Image();
      logoutImg.src = 'https://feme-limited-sandbox.mybigcommerce.com/login.php?action=logout&t=' + Date.now();

      await new Promise(resolve => setTimeout(resolve, 500));

      window.top
        ? (window.top.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/')
        : (window.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('b2b_token');
      localStorage.removeItem('user');
      localStorage.removeItem('b2b_user');
      window.top
        ? (window.top.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/')
        : (window.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/');
    }
  };

  if (onLogout) {
    // Register the logout handler for the bottom nav "More" sheet
  }

  const initials = getInitials(user.name || '');

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200">
      <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center" data-testid="link-logo">
          <img src={femeLogo} alt="FEME" className="h-7 md:h-8" />
        </Link>

        <div className="flex items-center gap-4 md:gap-6">
          {/* SHOP link — desktop only */}
          <a
            href="https://feme-limited-sandbox.mybigcommerce.com/"
            onClick={handleHomeClick}
            className="hidden md:inline text-sm font-medium text-gray-700 hover:text-black"
            data-testid="link-home"
          >
            {ssoLoading ? 'Loading...' : 'SHOP'}
          </a>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto p-0 hover:bg-transparent" data-testid="header-user-menu">
                {/* Mobile: initials avatar */}
                <span className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-black text-white text-xs font-medium">
                  {initials}
                </span>
                {/* Desktop: name + chevron */}
                <span className="hidden md:flex items-center">
                  <span className="text-sm font-medium text-gray-700">{user.name || 'User'}</span>
                  <ChevronDown className="ml-1 h-4 w-4 text-gray-700" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
              <div className="p-2">
                <p className="text-sm font-medium">{user.name || 'User'}</p>
                <p className="text-xs text-gray-500">{user.email || 'user@company.com'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={loading} data-testid="menu-logout">
                {loading ? 'Logging out...' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
