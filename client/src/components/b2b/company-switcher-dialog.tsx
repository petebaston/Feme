import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

interface Company {
  id: string;
  name: string;
  email: string;
  status: string;
  tier: string;
  hierarchyLevel: number;
}

interface CompanySwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCompanyId: string;
}

export function CompanySwitcherDialog({ open, onOpenChange, currentCompanyId }: CompanySwitcherProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState(currentCompanyId);

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['/api/company/accessible'],
    enabled: open,
    staleTime: 300000,
  });

  const switchCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await apiRequest("POST", "/api/company/switch", { companyId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: "Company Switched",
        description: "You are now viewing data for the selected company",
      });
      onOpenChange(false);
      // Reload page to refresh all company-specific data
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch company",
        variant: "destructive",
      });
    },
  });

  const handleSwitch = () => {
    if (selectedCompanyId !== currentCompanyId) {
      switchCompanyMutation.mutate(selectedCompanyId);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      premium: 'bg-purple-100 text-purple-800 border-purple-200',
      standard: 'bg-blue-100 text-blue-800 border-blue-200',
      basic: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[tier?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Company</DialogTitle>
          <DialogDescription>
            Select a company to view and manage their data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : companies && companies.length > 0 ? (
            companies.map((company) => {
              const isSelected = company.id === selectedCompanyId;
              const isCurrent = company.id === currentCompanyId;

              return (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate">
                          {company.name}
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate">{company.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className={getTierColor(company.tier)}>
                          {company.tier}
                        </Badge>
                        {company.hierarchyLevel > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Level {company.hierarchyLevel}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-black flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-8 text-sm text-gray-500">
              No accessible companies found
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={switchCompanyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSwitch}
            disabled={selectedCompanyId === currentCompanyId || switchCompanyMutation.isPending}
            className="bg-black text-white hover:bg-gray-800"
          >
            {switchCompanyMutation.isPending ? 'Switching...' : 'Switch Company'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
