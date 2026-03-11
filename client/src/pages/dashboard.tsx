import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Building2, FileText, MapPin, Users, Settings } from "lucide-react";

const navTiles = [
  { name: 'My Orders', href: '/my-orders', icon: Package, description: 'View your personal order history' },
  { name: 'Company Orders', href: '/orders', icon: Building2, description: 'View all company orders' },
  { name: 'Invoices', href: '/invoices', icon: FileText, description: 'Manage and pay invoices' },
  { name: 'Addresses', href: '/addresses', icon: MapPin, description: 'Manage delivery addresses' },
  { name: 'User Management', href: '/user-management', icon: Users, description: 'Manage company users' },
  { name: 'Account Settings', href: '/account-settings', icon: Settings, description: 'Update your account details' },
];

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('b2b_user') || localStorage.getItem('user') || '{}');

  const { data: credit, isLoading: creditLoading } = useQuery<any>({
    queryKey: ['/api/company/credit'],
    staleTime: 300000,
    retry: 0,
  });

  const balance = credit?.balance ?? credit?.creditLimit ?? 0;
  const dueNow = credit?.availableCredit ?? credit?.outstandingBalance ?? 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-normal text-black">Welcome back, {user.name || user.firstName || 'User'}</h1>
        <p className="text-sm text-gray-500 mt-1">{user.companyName || ''}</p>
      </div>

      {/* Navigation Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {navTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex flex-col items-start gap-3 p-6 bg-white border border-gray-200 hover:border-black hover:shadow-sm transition-all group"
              data-testid={`tile-${tile.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="w-6 h-6 text-gray-400 group-hover:text-black transition-colors" />
              <div>
                <p className="text-sm font-medium text-black">{tile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{tile.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Financial Summary */}
      <div>
        <h2 className="text-lg font-normal text-black mb-4">Financial Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 p-6" data-testid="card-balance">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Balance</p>
            {creditLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-normal text-black" data-testid="text-balance">{formatCurrency(balance)}</p>
            )}
          </div>
          <div className="bg-white border border-gray-200 p-6" data-testid="card-due-now">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Due Now</p>
            {creditLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-normal text-black" data-testid="text-due-now">{formatCurrency(dueNow)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
