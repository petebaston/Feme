import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { CompanySwitcher } from "@/components/b2b/company-switcher";

export default function Header() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('b2b_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('b2b_token');
    localStorage.removeItem('b2b_store_hash');
    localStorage.removeItem('b2b_channel_id');
    localStorage.removeItem('b2b_user');
    
    toast({
      title: "Logged out",
      description: "You have been signed out.",
    });
    
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center space-x-4 md:ml-12">
          <Link href="/" className="flex items-center space-x-2" data-testid="link-logo">
            <span className="font-bold text-2xl tracking-tight text-black">feme</span>
          </Link>
        </div>

        <div className="ml-auto flex items-center space-x-2 md:space-x-4">
          <CompanySwitcher />
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="header-user-menu">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-black text-white text-sm">
                    {user.name?.split(' ').map((n: string) => n[0]).join('') || user.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium text-sm">{user.name || 'User'}</p>
                  <p className="text-xs text-gray-600">{user.email || 'user@company.com'}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild data-testid="menu-dashboard">
                <Link href="/dashboard" className="cursor-pointer">
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid="menu-company">
                <Link href="/company" className="cursor-pointer">
                  Company
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
