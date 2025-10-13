import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Edit, Trash2, Star } from "lucide-react";

interface AddAddressDialogProps {
  children?: React.ReactNode;
}

export function AddAddressDialog({ children }: AddAddressDialogProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("shipping");
  const [isDefault, setIsDefault] = useState(false);
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const { toast } = useToast();

  const createAddressMutation = useMutation({
    mutationFn: async (addressData: any) => {
      return await apiRequest("POST", "/api/addresses", addressData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/addresses'] });
      toast({
        title: "Address added",
        description: "The address has been added successfully.",
      });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add address",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setLabel("");
    setType("shipping");
    setIsDefault(false);
    setStreet1("");
    setStreet2("");
    setCity("");
    setState("");
    setPostalCode("");
    setCountry("US");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = JSON.parse(localStorage.getItem('b2b_user') || '{}').companyId;
    createAddressMutation.mutate({
      label,
      type,
      isDefault,
      street1,
      street2,
      city,
      state,
      postalCode,
      country,
      companyId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline" data-testid="button-add-address">
            <MapPin className="mr-2 h-4 w-4" />
            Add Address
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]" data-testid="dialog-add-address">
        <DialogHeader>
          <DialogTitle>Add New Address</DialogTitle>
          <DialogDescription>
            Add a shipping or billing address for your company.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                type="text"
                placeholder="e.g., Main Office"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="input-address-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-address-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="street1">Street Address *</Label>
            <Input
              id="street1"
              type="text"
              placeholder="123 Main St"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              required
              data-testid="input-address-street1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="street2">Apt, Suite, etc.</Label>
            <Input
              id="street2"
              type="text"
              placeholder="Suite 100"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              data-testid="input-address-street2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                type="text"
                placeholder="San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                data-testid="input-address-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                type="text"
                placeholder="CA"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                data-testid="input-address-state"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code *</Label>
              <Input
                id="postalCode"
                type="text"
                placeholder="94102"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                data-testid="input-address-postal-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger data-testid="select-address-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="MX">Mexico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              data-testid="checkbox-address-default"
            />
            <Label htmlFor="isDefault" className="text-sm font-normal">
              Set as default {type} address
            </Label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-add-address">
              Cancel
            </Button>
            <Button type="submit" disabled={createAddressMutation.isPending} data-testid="button-save-address">
              {createAddressMutation.isPending ? "Adding..." : "Add Address"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditAddressDialogProps {
  address: any;
  children?: React.ReactNode;
}

export function EditAddressDialog({ address, children }: EditAddressDialogProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(address.label || "");
  const [type, setType] = useState(address.type || "shipping");
  const [street1, setStreet1] = useState(address.street1 || "");
  const [street2, setStreet2] = useState(address.street2 || "");
  const [city, setCity] = useState(address.city || "");
  const [state, setState] = useState(address.state || "");
  const [postalCode, setPostalCode] = useState(address.postalCode || "");
  const [country, setCountry] = useState(address.country || "US");
  const { toast } = useToast();

  const updateAddressMutation = useMutation({
    mutationFn: async (addressData: any) => {
      return await apiRequest("PATCH", `/api/addresses/${address.id}`, addressData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/addresses'] });
      toast({
        title: "Address updated",
        description: "The address has been updated successfully.",
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update address",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAddressMutation.mutate({
      label,
      type,
      street1,
      street2,
      city,
      state,
      postalCode,
      country,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" data-testid={`button-edit-address-${address.id}`}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]" data-testid={`dialog-edit-address-${address.id}`}>
        <DialogHeader>
          <DialogTitle>Edit Address</DialogTitle>
          <DialogDescription>
            Update the address information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label</Label>
              <Input
                id="edit-label"
                type="text"
                placeholder="e.g., Main Office"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="input-edit-address-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-edit-address-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-street1">Street Address *</Label>
            <Input
              id="edit-street1"
              type="text"
              placeholder="123 Main St"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              required
              data-testid="input-edit-address-street1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-street2">Apt, Suite, etc.</Label>
            <Input
              id="edit-street2"
              type="text"
              placeholder="Suite 100"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              data-testid="input-edit-address-street2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-city">City *</Label>
              <Input
                id="edit-city"
                type="text"
                placeholder="San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                data-testid="input-edit-address-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-state">State *</Label>
              <Input
                id="edit-state"
                type="text"
                placeholder="CA"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                data-testid="input-edit-address-state"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-postalCode">Postal Code *</Label>
              <Input
                id="edit-postalCode"
                type="text"
                placeholder="94102"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                data-testid="input-edit-address-postal-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger data-testid="select-edit-address-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="MX">Mexico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-edit-address">
              Cancel
            </Button>
            <Button type="submit" disabled={updateAddressMutation.isPending} data-testid="button-save-edit-address">
              {updateAddressMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteAddressDialogProps {
  address: any;
  children?: React.ReactNode;
}

export function DeleteAddressDialog({ address, children }: DeleteAddressDialogProps) {
  const { toast } = useToast();

  const deleteAddressMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/addresses/${address.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/addresses'] });
      toast({
        title: "Address deleted",
        description: "The address has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete address",
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" data-testid={`button-delete-address-${address.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent data-testid={`dialog-delete-address-${address.id}`}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Address?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this address. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-address">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteAddressMutation.mutate()}
            disabled={deleteAddressMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-address"
          >
            {deleteAddressMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SetDefaultAddressButtonProps {
  address: any;
}

export function SetDefaultAddressButton({ address }: SetDefaultAddressButtonProps) {
  const { toast } = useToast();

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/addresses/${address.id}/set-default`, { type: address.type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/addresses'] });
      toast({
        title: "Default address updated",
        description: `${address.label || 'Address'} is now the default ${address.type} address.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default address",
        variant: "destructive",
      });
    },
  });

  if (address.isDefault) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setDefaultMutation.mutate()}
      disabled={setDefaultMutation.isPending}
      data-testid={`button-set-default-${address.id}`}
    >
      <Star className="h-4 w-4" />
    </Button>
  );
}
