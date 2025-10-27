import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Addresses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<any>(null);
  const { toast } = useToast();

  const { data: addresses = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/company/addresses'],
    staleTime: 300000,
  });

  const filteredAddresses = addresses.filter((address) => {
    const matchesSearch = !searchTerm ||
      address.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.addressLine1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.addressLine2?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      address.zipCode?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleEdit = (address: any) => {
    setSelectedAddress(address);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (address: any) => {
    setAddressToDelete(address);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    toast({
      title: "Delete Address",
      description: "Address deletion is not yet implemented. This will be connected to the BigCommerce API.",
    });
    setIsDeleteDialogOpen(false);
    setAddressToDelete(null);
  };

  const handleSetDefault = (address: any) => {
    toast({
      title: "Set as Default",
      description: "Setting default address is not yet implemented. This will be connected to the BigCommerce API.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-normal text-black">Addresses</h1>
        <Button 
          className="bg-black text-white hover:bg-black/90"
          onClick={() => {
            setSelectedAddress(null);
            setIsEditDialogOpen(true);
          }}
          data-testid="button-add-address"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Address
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
            className="pl-10 h-10 bg-gray-100 border-0 focus-visible:ring-0 rounded-none"
          />
        </div>
        <button className="flex items-center justify-center w-10 h-10 border border-gray-300 hover:bg-gray-50">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Address Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredAddresses.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500" data-testid="text-no-addresses">
            No addresses found
          </div>
        ) : (
          filteredAddresses.map((address) => (
            <Card key={address.id || address.addressId} className="border border-gray-200" data-testid={`card-address-${address.id || address.addressId}`}>
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
                    <p className="font-medium text-black">
                      {`${address.firstName || ''} ${address.lastName || ''}`.trim() || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">{address.addressLine1 || address.address || 'N/A'}</p>
                    {address.addressLine2 && (
                      <p className="text-sm text-gray-700">{address.addressLine2}</p>
                    )}
                    <p className="text-sm text-gray-700">{address.city || 'N/A'}</p>
                    <p className="text-sm text-gray-700">
                      {address.zipCode || address.postalCode || 'N/A'}, {address.country || address.countryCode || 'N/A'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-sm font-normal border-gray-300"
                      onClick={() => handleSetDefault(address)}
                      disabled={address.isDefaultBilling && address.isDefaultShipping}
                      data-testid={`button-set-default-${address.id || address.addressId}`}
                    >
                      {address.isDefaultBilling && address.isDefaultShipping ? 'DEFAULT' : 'SET AS DEFAULT'}
                    </Button>
                    <div className="flex gap-2">
                      <button 
                        className="p-1.5 hover:bg-gray-50 rounded" 
                        onClick={() => handleEdit(address)}
                        data-testid={`button-edit-${address.id || address.addressId}`}
                      >
                        <Pencil className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-gray-50 rounded" 
                        onClick={() => handleDelete(address)}
                        data-testid={`button-delete-${address.id || address.addressId}`}
                      >
                        <Trash2 className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 text-sm text-gray-600">
        <span>Cards per page: <span className="font-medium">12</span></span>
        <span>1–{filteredAddresses.length} of {filteredAddresses.length}</span>
        <div className="flex gap-2">
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
            ‹
          </button>
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
            ›
          </button>
        </div>
      </div>

      {/* Edit/View Address Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAddress ? 'View Address' : 'Add Address'}</DialogTitle>
            <DialogDescription>
              {selectedAddress ? 'Address details from BigCommerce' : 'Add a new address to your account'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAddress ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">First Name</p>
                  <p className="text-base">{selectedAddress.firstName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Last Name</p>
                  <p className="text-base">{selectedAddress.lastName}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Address Line 1</p>
                <p className="text-base">{selectedAddress.addressLine1}</p>
              </div>
              
              {selectedAddress.addressLine2 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Address Line 2</p>
                  <p className="text-base">{selectedAddress.addressLine2}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">City</p>
                  <p className="text-base">{selectedAddress.city}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">State/Province</p>
                  <p className="text-base">{selectedAddress.stateName || selectedAddress.stateCode || 'N/A'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Postal Code</p>
                  <p className="text-base">{selectedAddress.zipCode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Country</p>
                  <p className="text-base">{selectedAddress.countryName}</p>
                </div>
              </div>

              {selectedAddress.phoneNumber && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-base">{selectedAddress.phoneNumber}</p>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                {selectedAddress.isDefaultShipping && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-[#C4D600] text-black">
                    Default Shipping
                  </span>
                )}
                {selectedAddress.isDefaultBilling && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-[#C4D600] text-black">
                    Default Billing
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-gray-500">
              <p>Address creation will be connected to the BigCommerce API.</p>
              <p className="text-sm mt-2">Contact support to enable address management.</p>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
              {addressToDelete && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <p className="font-medium">{addressToDelete.firstName} {addressToDelete.lastName}</p>
                  <p className="text-sm">{addressToDelete.addressLine1}</p>
                  <p className="text-sm">{addressToDelete.city}, {addressToDelete.zipCode}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
