import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown } from "lucide-react";
import femeLogo from "@assets/feme-logo.png";

export default function Header() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('b2b_user') || '{}');

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

      toast({
        title: "Logged out",
        description: "You have been signed out.",
      });

      setLocation('/login');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('b2b_token');
      localStorage.removeItem('user');
      localStorage.removeItem('b2b_user');
      setLocation('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200">
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center" data-testid="link-logo">
          <img src={femeLogo} alt="FEME" className="h-8" />
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-gray-700 hover:text-black">
            HOME
          </Link>
          <Link href="/cart" className="text-sm font-medium text-gray-700 hover:text-black">
            CART
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto p-0 hover:bg-transparent" data-testid="header-user-menu">
                <span className="text-sm font-medium text-gray-700">{user.name || 'User'}</span>
                <ChevronDown className="ml-1 h-4 w-4 text-gray-700" />
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
