import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data - in production this would come from an API
  const users = [
    {
      id: 1,
      name: "Joe Blogs",
      email: "afrowholesaledirect@FEME.com",
      role: "Admin",
      company: "TEST Affro Wholesale Direct Ltd",
      status: "Active",
      lastLogin: "23rd Sep 2025",
    },
  ];

  const filteredUsers = users.filter((user) => {
    const matchesSearch = !searchTerm ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-normal text-black">User management</h1>
        <Button className="bg-black text-white hover:bg-black/90">
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
          />
        </div>
        <button className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-md hover:bg-gray-50">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-md bg-white">
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
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-gray-700">{user.email}</TableCell>
                  <TableCell className="text-gray-700">{user.role}</TableCell>
                  <TableCell className="text-gray-700">{user.company}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700">{user.lastLogin}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
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
        <span>1–1 of 1</span>
        <div className="flex gap-2">
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
            ‹
          </button>
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
