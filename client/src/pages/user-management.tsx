import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/company/users'],
    staleTime: 300000,
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch = !searchTerm ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-normal text-black">User management</h1>
        <Button className="bg-black text-white hover:bg-black/90" data-testid="button-add-user">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 bg-gray-100 border-0 focus-visible:ring-0"
            data-testid="input-search"
          />
        </div>
        <button className="flex items-center justify-center w-10 h-10 border border-gray-300 hover:bg-gray-50" data-testid="button-filter">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium">Name</TableHead>
              <TableHead className="font-medium">Email</TableHead>
              <TableHead className="font-medium">Role</TableHead>
              <TableHead className="font-medium">Company</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="font-medium">Last Login</TableHead>
              <TableHead className="font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TableRow key={user.id || user.userId} className="hover:bg-gray-50" data-testid={`row-user-${user.id || user.userId}`}>
                  <TableCell className="font-medium" data-testid={`text-name-${user.id || user.userId}`}>
                    {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}
                  </TableCell>
                  <TableCell className="text-gray-700" data-testid={`text-email-${user.id || user.userId}`}>{user.email || 'N/A'}</TableCell>
                  <TableCell className="text-gray-700" data-testid={`text-role-${user.id || user.userId}`}>{user.role || 'User'}</TableCell>
                  <TableCell className="text-gray-700" data-testid={`text-company-${user.id || user.userId}`}>{user.companyName || user.company || 'N/A'}</TableCell>
                  <TableCell data-testid={`status-user-${user.id || user.userId}`}>
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-medium ${
                      user.status === 'active' ? 'bg-[#C4D600] text-black' : 'bg-gray-200 text-gray-800'
                    }`}>
                      {user.status || 'Active'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700" data-testid={`text-lastlogin-${user.id || user.userId}`}>
                    {user.lastLogin || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs" data-testid={`button-edit-${user.id || user.userId}`}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" data-testid={`button-remove-${user.id || user.userId}`}>
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500" data-testid="text-no-users">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 text-sm text-gray-600">
        <span>Rows per page: <span className="font-medium">10</span></span>
        <span>{filteredUsers.length > 0 ? `1–${Math.min(10, filteredUsers.length)} of ${filteredUsers.length}` : '0 of 0'}</span>
        <div className="flex gap-2">
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 hover:bg-gray-50 disabled:opacity-50" disabled data-testid="button-prev-page">
            ‹
          </button>
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 hover:bg-gray-50 disabled:opacity-50" disabled data-testid="button-next-page">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
