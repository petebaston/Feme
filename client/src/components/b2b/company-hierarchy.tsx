import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Company {
  id: string;
  name: string;
  email: string;
  status: string;
  tier: string;
  hierarchyLevel: number;
  parentCompanyId: string | null;
}

interface HierarchyData {
  parent: Company | null;
  children: Company[];
  current: Company;
}

export function CompanyHierarchy({ companyId }: { companyId: string }) {
  const { data: hierarchy, isLoading } = useQuery<HierarchyData>({
    queryKey: ['/api/company/hierarchy', companyId],
    staleTime: 300000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!hierarchy) {
    return null;
  }

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      premium: 'bg-purple-100 text-purple-800',
      standard: 'bg-blue-100 text-blue-800',
      basic: 'bg-gray-100 text-gray-800',
    };
    return colors[tier?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Company Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parent Company */}
        {hierarchy.parent && (
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-600" />
                  <span className="font-medium">Parent Company</span>
                </div>
                <p className="text-sm text-gray-900 mt-1">{hierarchy.parent.name}</p>
                <p className="text-xs text-gray-600">{hierarchy.parent.email}</p>
              </div>
              <Badge className={getTierColor(hierarchy.parent.tier)}>
                {hierarchy.parent.tier}
              </Badge>
            </div>
          </div>
        )}

        {/* Current Company */}
        <div className="p-4 border-2 border-black rounded-lg bg-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-black" />
                <span className="font-semibold">Current Company</span>
              </div>
              <p className="text-sm text-gray-900 mt-1 font-medium">{hierarchy.current.name}</p>
              <p className="text-xs text-gray-600">{hierarchy.current.email}</p>
            </div>
            <Badge className={getTierColor(hierarchy.current.tier)}>
              {hierarchy.current.tier}
            </Badge>
          </div>
        </div>

        {/* Subsidiary Companies */}
        {hierarchy.children && hierarchy.children.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <ChevronRight className="w-4 h-4" />
              Subsidiaries ({hierarchy.children.length})
            </div>
            <div className="space-y-2 pl-6">
              {hierarchy.children.map((child) => (
                <div
                  key={child.id}
                  className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{child.name}</p>
                      <p className="text-xs text-gray-600">{child.email}</p>
                    </div>
                    <Badge className={getTierColor(child.tier)} variant="outline">
                      {child.tier}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hierarchy.parent && (!hierarchy.children || hierarchy.children.length === 0) && (
          <div className="text-center py-4 text-sm text-gray-500">
            No hierarchy relationships configured
          </div>
        )}
      </CardContent>
    </Card>
  );
}
