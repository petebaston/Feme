import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Addresses() {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data - in production this would come from an API
  const addresses = [
    {
      id: 1,
      name: "Joe Blogs",
      address1: "99 Limes Road",
      city: "London, Surrey",
      postcode: "CR0 2HE",
      country: "United Kingdom",
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  ];

  const filteredAddresses = addresses.filter((address) => {
    const matchesSearch = !searchTerm ||
      address.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.address1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-normal text-black">Addresses</h1>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 bg-gray-100 border-0 focus-visible:ring-0 rounded-none"
          />
        </div>
        <button className="flex items-center justify-center w-10 h-10 border border-gray-300 hover:bg-gray-50">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Address Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAddresses.map((address) => (
          <Card key={address.id} className="border border-gray-200">
            <CardContent className="p-6">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {address.isDefaultShipping && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-[#C4D600] text-black">
                    Default shipping
                  </span>
                )}
                {address.isDefaultBilling && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-[#C4D600] text-black">
                    Default billing
                  </span>
                )}
              </div>

              {/* Address Details */}
              <div className="space-y-1 mb-4">
                <p className="font-medium text-black">{address.name}</p>
                <p className="text-sm text-gray-700">{address.address1}</p>
                <p className="text-sm text-gray-700">{address.city}</p>
                <p className="text-sm text-gray-700">{address.postcode}, {address.country}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm font-normal border-gray-300"
                >
                  SET AS DEFAULT
                </Button>
                <div className="flex gap-2">
                  <button className="p-1.5 hover:bg-gray-100 rounded">
                    <Pencil className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded">
                    <Trash2 className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 text-sm text-gray-600">
        <span>Cards per page: <span className="font-medium">12</span></span>
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
