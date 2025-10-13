import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

interface Company {
  id: string;
  name: string;
  hierarchyLevel: number;
  parentCompanyId: string | null;
  status: string;
}

export function CompanySwitcher() {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('b2b_user') || '{}');
  const [selectedCompanyId, setSelectedCompanyId] = useState(currentUser.companyId || '');

  const { data: accessibleCompanies, isLoading } = useQuery<Company[]>({
    queryKey: ['/api/company/accessible'],
    enabled: !!currentUser.id,
    staleTime: 60000,
  });

  const { data: hierarchy } = useQuery<{ parent: Company | null; children: Company[] }>({
    queryKey: ['/api/company/hierarchy?companyId=' + selectedCompanyId],
    enabled: !!selectedCompanyId,
    staleTime: 60000,
  });

  const selectedCompany = accessibleCompanies?.find(c => c.id === selectedCompanyId);

  const handleCompanySwitch = (companyId: string) => {
    const newCompany = accessibleCompanies?.find(c => c.id === companyId);
    if (newCompany) {
      setSelectedCompanyId(companyId);
      // Update user's company in localStorage
      const updatedUser = { ...currentUser, companyId };
      localStorage.setItem('b2b_user', JSON.stringify(updatedUser));
      setOpen(false);
      // Refresh the page to load new company data
      window.location.reload();
    }
  };

  // Only show if user has permission and multiple companies are available
  if (!can('switch_companies') || !accessibleCompanies || accessibleCompanies.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between min-w-[200px]"
            data-testid="button-company-switcher"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {selectedCompany?.name || 'Select company'}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" data-testid="popover-company-switcher">
          <Command>
            <CommandInput placeholder="Search companies..." />
            <CommandList>
              <CommandEmpty>No companies found.</CommandEmpty>
              <CommandGroup heading="Accessible Companies">
                {accessibleCompanies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={company.id}
                    onSelect={() => handleCompanySwitch(company.id)}
                    data-testid={`company-option-${company.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCompanyId === company.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {company.hierarchyLevel > 0 && '↳ '}{company.name}
                        </span>
                        {company.hierarchyLevel === 0 && (
                          <span className="text-xs text-muted-foreground">Parent Company</span>
                        )}
                        {company.hierarchyLevel > 0 && (
                          <span className="text-xs text-muted-foreground">Subsidiary</span>
                        )}
                      </div>
                      {company.status === 'active' && (
                        <Badge variant="outline" className="ml-2 text-xs">Active</Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hierarchy && (hierarchy.parent || hierarchy.children.length > 0) && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {hierarchy.parent && (
            <span>Child of {hierarchy.parent.name}</span>
          )}
          {hierarchy.children.length > 0 && (
            <span>• {hierarchy.children.length} {hierarchy.children.length === 1 ? 'subsidiary' : 'subsidiaries'}</span>
          )}
        </div>
      )}
    </div>
  );
}
