import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

export default function AccountSettings() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "Joe",
    lastName: "Blogs",
    email: "afrowholesaledirect@FEME.com",
    phone: "",
    currentPassword: "**********",
    newPassword: "",
    confirmPassword: "",
  });

  const { data: companyCredit } = useQuery<{
    creditEnabled: boolean;
    creditCurrency: string;
    creditLimit: number;
    availableCredit: number;
    balance: number;
  }>({ queryKey: ['/api/company/credit'] });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Settings Updated",
      description: "Your account settings have been saved successfully.",
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-normal text-black">
          Account settings
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
            First name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="h-11 border-gray-300"
            required
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
            Last name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="h-11 border-gray-300"
            required
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="h-11 border-gray-300"
            required
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
            Phone number
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="h-11 border-gray-300"
            placeholder=""
          />
        </div>

        {/* Company User (Disabled) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-500">
            Company user 1234
          </Label>
          <div className="h-11 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500">
            Company user 1234
          </div>
        </div>

        {/* Company (Disabled) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-500">
            Company
          </Label>
          <div className="h-11 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500">
            TEST Affro Wholesale Direct Ltd
          </div>
        </div>

        {/* Role (Disabled) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-500">
            Role
          </Label>
          <div className="h-11 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500">
            Admin
          </div>
        </div>

        {/* Credit Limit (Disabled) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-500">
            Credit limit
          </Label>
          <div className="h-11 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500">
            {formatCurrency(companyCredit?.creditLimit || 0, companyCredit?.creditCurrency || 'GBP')}
          </div>
        </div>

        {/* Current Password */}
        <div className="space-y-2">
          <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
            Current password
          </Label>
          <Input
            id="currentPassword"
            type="password"
            value={formData.currentPassword}
            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
            className="h-11 border-gray-300 bg-gray-100"
            disabled
          />
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
            Password
          </Label>
          <Input
            id="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            className="h-11 border-gray-300"
            placeholder=""
          />
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="h-11 border-gray-300"
            placeholder=""
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 bg-black text-white hover:bg-black/90 font-normal text-base"
        >
          SAVE UPDATES
        </Button>
      </form>
    </div>
  );
}
