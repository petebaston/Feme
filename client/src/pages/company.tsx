import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { InviteUserDialog, EditUserDialog, DeactivateUserDialog } from "@/components/b2b/user-dialogs";
import { AddAddressDialog, EditAddressDialog, DeleteAddressDialog, SetDefaultAddressButton } from "@/components/b2b/address-dialogs";
import { CompanyHierarchy } from "@/components/b2b/company-hierarchy";
import { CompanySwitcherDialog } from "@/components/b2b/company-switcher-dialog";
import { MoreVertical, Building2, ArrowLeftRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/currency";

export default function Company() {
  const { can } = usePermissions();
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);

  const { data: company, isLoading: companyLoading } = useQuery<any>({
    queryKey: ['/api/company'],
    staleTime: 300000,
  });

  const { data: users, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/company/users'],
    staleTime: 300000,
  });

  const { data: addresses, isLoading: addressesLoading } = useQuery<any[]>({
    queryKey: ['/api/company/addresses'],
    staleTime: 300000,
  });

  const currentUser = JSON.parse(localStorage.getItem('b2b_user') || '{}');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Company Management</h1>
          <p className="text-muted-foreground">Manage your company profile and team members</p>
        </div>
        <div className="flex gap-3">
          {can('switch_companies') && (
            <Button
              variant="outline"
              onClick={() => setShowCompanySwitcher(true)}
              data-testid="button-switch-company"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Switch Company
            </Button>
          )}
          {can('manage_company') && (
            <Button variant="outline" data-testid="button-edit-company">
              Edit Company
            </Button>
          )}
          {can('manage_users') && <InviteUserDialog />}
        </div>
      </div>

      {/* Company Switcher Dialog (Item 12) */}
      <CompanySwitcherDialog
        open={showCompanySwitcher}
        onOpenChange={setShowCompanySwitcher}
        currentCompanyId={company?.id || ''}
      />

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-green-200 bg-green-50">
          <CardContent className="p-6">
            <p className="text-sm text-green-700 mb-1">Credit Limit</p>
            <p className="text-3xl font-bold text-green-900" data-testid="credit-limit-card">
              £{(company?.creditLimit || 50000).toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-2">Available for orders</p>
          </CardContent>
        </Card>
        
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-700 mb-1">Payment Terms</p>
            <p className="text-3xl font-bold text-blue-900" data-testid="payment-terms-card">
              {company?.paymentTerms || 'Net 30'}
            </p>
            <p className="text-xs text-blue-600 mt-2">Standard terms</p>
          </CardContent>
        </Card>
        
        <Card className="border border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <p className="text-sm text-purple-700 mb-1">Pricing Tier</p>
            <p className="text-3xl font-bold text-purple-900" data-testid="pricing-tier-card">
              {company?.tier || 'Standard'}
            </p>
            <p className="text-xs text-purple-600 mt-2">Custom pricing available</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>Your company information and settings</CardDescription>
        </CardHeader>
        <CardContent>
          {companyLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold" data-testid="company-name">
                    {company?.name || 'Your Company'}
                  </h3>
                  <p className="text-muted-foreground">{company?.industry || 'Business'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" data-testid="company-status">
                      {company?.status || 'Active'}
                    </Badge>
                    <Badge variant="secondary">
                      {company?.tier || 'Standard'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Company Email</h4>
                    <p data-testid="company-email">{company?.email || 'contact@company.com'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Phone Number</h4>
                    <p data-testid="company-phone">{company?.phone || '+1 (555) 123-4567'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Tax ID</h4>
                    <p data-testid="company-tax-id">{company?.taxId || '***-***-***'}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Account Manager</h4>
                    <p data-testid="account-manager">{company?.accountManager || 'John Smith'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Credit Limit</h4>
                    <p data-testid="credit-limit">£{company?.creditLimit?.toLocaleString() || '50,000'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Payment Terms</h4>
                    <p data-testid="payment-terms">{company?.paymentTerms || 'Net 30'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage users and their permissions</CardDescription>
            </div>
            <Button size="sm" data-testid="button-manage-users">
              Manage Users
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            ) : users?.length ? (
              users.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg" data-testid={`user-item-${user.id}`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {user.name?.split(' ').map((n: string) => n[0]).join('') || user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{user.name || user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.jobTitle && (
                        <p className="text-xs text-muted-foreground">{user.jobTitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                      {user.role || 'User'}
                    </Badge>
                    {user.status === 'inactive' && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                    {user.id === currentUser.id && (
                      <Badge variant="secondary">You</Badge>
                    )}
                    {user.id !== currentUser.id && can('manage_users') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-user-actions-${user.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <EditUserDialog user={user}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Edit User
                            </DropdownMenuItem>
                          </EditUserDialog>
                          <DeactivateUserDialog user={user}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                              Deactivate User
                            </DropdownMenuItem>
                          </DeactivateUserDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No team members found</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Invite Your First Team Member
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Hierarchy (Item 11) */}
      {company?.id && can('switch_companies') && (
        <CompanyHierarchy companyId={company.id} />
      )}

      {/* Company Addresses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Company Addresses</CardTitle>
              <CardDescription>Shipping and billing addresses</CardDescription>
            </div>
            {can('manage_addresses') && <AddAddressDialog />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {addressesLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="border border-border">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : addresses?.length ? (
              addresses.map((address: any) => (
                <Card key={address.id} className="border border-border" data-testid={`address-item-${address.id}`}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{address.label || 'Address'}</h4>
                            {address.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {address.type || 'Shipping'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>{address.street1}</p>
                            {address.street2 && <p>{address.street2}</p>}
                            <p>{address.city}, {address.state} {address.postalCode}</p>
                            <p>{address.country}</p>
                          </div>
                        </div>
                        {can('manage_addresses') && (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-address-actions-${address.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <EditAddressDialog address={address}>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    Edit Address
                                  </DropdownMenuItem>
                                </EditAddressDialog>
                                {!address.isDefault && (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      const btn = document.querySelector(`[data-testid="button-set-default-${address.id}"]`) as HTMLButtonElement;
                                      btn?.click();
                                    }}
                                  >
                                    Set as Default
                                  </DropdownMenuItem>
                                )}
                                <DeleteAddressDialog address={address}>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                    Delete Address
                                  </DropdownMenuItem>
                                </DeleteAddressDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="hidden">
                              <SetDefaultAddressButton address={address} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                <p>No addresses found</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Add Your First Address
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
