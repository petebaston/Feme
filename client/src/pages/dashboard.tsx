import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Building2, FileText, MapPin, Users, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const navTiles = [
  { name: 'My Orders', href: '/my-orders', icon: Package, description: 'View your personal order history' },
  { name: 'Company Orders', href: '/orders', icon: Building2, description: 'View all company orders' },
  { name: 'Invoices', href: '/invoices', icon: FileText, description: 'Manage and pay invoices' },
  { name: 'Addresses', href: '/addresses', icon: MapPin, description: 'Manage delivery addresses' },
  { name: 'User Management', href: '/user-management', icon: Users, description: 'Manage company users' },
  { name: 'Account Settings', href: '/account-settings', icon: Settings, description: 'Update your account details' },
];

function calculateInvoiceStatus(invoice: any): 'Paid' | 'Overdue' | 'Unpaid' {
  const openBalance = parseFloat(invoice.openBalance?.value || '0');
  if (openBalance <= 0) return 'Paid';
  const dueDate = invoice.dueDate ? new Date(
    typeof invoice.dueDate === 'number' ? invoice.dueDate * 1000 : invoice.dueDate
  ) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dueDate) {
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'Overdue';
  }
  return 'Unpaid';
}

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('b2b_user') || localStorage.getItem('user') || '{}');

  const { data: invoices, isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    staleTime: 300000,
    retry: 0,
  });

  // Total outstanding = sum of all open balances > 0
  const totalOutstanding = (invoices || []).reduce((sum: number, inv: any) => {
    const balance = parseFloat(inv.openBalance?.value || '0');
    return balance > 0 ? sum + balance : sum;
  }, 0);

  // Overdue = sum of balances on invoices past their due date
  const totalOverdue = (invoices || []).reduce((sum: number, inv: any) => {
    const balance = parseFloat(inv.openBalance?.value || '0');
    if (balance > 0 && calculateInvoiceStatus(inv) === 'Overdue') {
      return sum + balance;
    }
    return sum;
  }, 0);

  const currencyCode = invoices?.[0]?.openBalance?.code || 'GBP';

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
          <div className="bg-white border border-gray-200 p-6" data-testid="card-outstanding">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Outstanding Balance</p>
            {invoicesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-normal text-black" data-testid="text-outstanding">
                {formatCurrency(totalOutstanding, currencyCode)}
              </p>
            )}
          </div>
          <div className="bg-white border border-gray-200 p-6" data-testid="card-overdue">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Overdue</p>
            {invoicesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={`text-3xl font-normal ${totalOverdue > 0 ? 'text-red-600' : 'text-black'}`} data-testid="text-overdue">
                {formatCurrency(totalOverdue, currencyCode)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
