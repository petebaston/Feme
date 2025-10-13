import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, ShoppingCart, Trash2, Share2, Package, Edit, Minus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertShoppingListSchema, insertShoppingListItemSchema, type ShoppingList, type ShoppingListItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { z } from "zod";

const createListSchema = insertShoppingListSchema.omit({
  companyId: true,
  userId: true,
  status: true,
  isShared: true,
}).extend({
  name: z.string().min(1, "Name is required"),
});

const addItemSchema = insertShoppingListItemSchema.omit({
  listId: true,
}).extend({
  productName: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  price: z.coerce.number().min(0, "Price must be positive"),
});

export default function ShoppingLists() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userData, setUserData] = useState<{ id: string; companyId: string } | null>(null);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);

  useEffect(() => {
    const userDataStr = localStorage.getItem('b2b_user');
    if (userDataStr) {
      try {
        const user = JSON.parse(userDataStr);
        setUserData({ id: user.id, companyId: user.companyId });
      } catch (error) {
        console.error('Failed to parse user data:', error);
      }
    }
  }, []);

  const { data: lists = [], isLoading } = useQuery<ShoppingList[]>({
    queryKey: ["/api/shopping-lists"],
  });

  const form = useForm({
    resolver: zodResolver(createListSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createListSchema>) => {
      if (!userData) {
        throw new Error("User data not available");
      }
      const response = await apiRequest("POST", "/api/shopping-lists", {
        ...data,
        companyId: userData.companyId,
        userId: userData.id,
        status: "active",
        isShared: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Shopping list created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create shopping list",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shopping-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      toast({
        title: "Success",
        description: "Shopping list deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete shopping list",
        variant: "destructive",
      });
    },
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<ShoppingListItem[]>({
    queryKey: ["/api/shopping-lists", selectedList?.id, "items"],
    enabled: !!selectedList,
  });

  const itemForm = useForm({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      productId: "",
      productName: "",
      sku: "",
      quantity: 1,
      price: "0",
      imageUrl: "",
      variantId: "",
      notes: "",
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addItemSchema>) => {
      if (!selectedList) throw new Error("No list selected");
      const response = await apiRequest("POST", `/api/shopping-lists/${selectedList.id}/items`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedList?.id, "items"] });
      itemForm.reset();
      toast({
        title: "Success",
        description: "Item added to shopping list",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shopping-list-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedList?.id, "items"] });
      toast({
        title: "Success",
        description: "Item removed from shopping list",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const response = await apiRequest("PATCH", `/api/shopping-list-items/${id}`, { quantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedList?.id, "items"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive",
      });
    },
  });

  const toggleShareMutation = useMutation({
    mutationFn: async ({ id, isShared }: { id: string; isShared: boolean }) => {
      const response = await apiRequest("PATCH", `/api/shopping-lists/${id}`, { isShared });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      toast({
        title: "Success",
        description: variables.isShared ? "List shared successfully" : "List unshared successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sharing status",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof createListSchema>) => {
    createMutation.mutate(data);
  };

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-black">Shopping Lists</h1>
          <p className="text-sm text-gray-600 mt-1">Create and manage your shopping lists</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-black hover:bg-gray-800" 
              data-testid="button-create-list"
              disabled={!userData}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Shopping List</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>List Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Office Supplies" {...field} data-testid="input-list-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add notes about this list..."
                          {...field}
                          data-testid="input-list-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-black hover:bg-gray-800"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createMutation.isPending ? "Creating..." : "Create List"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search shopping lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-lists"
          />
          <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {filteredLists.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-black mb-2">No Shopping Lists</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              {searchQuery ? "No lists match your search" : "Create your first shopping list to get started"}
            </p>
            {!searchQuery && (
              <Button
                className="bg-black hover:bg-gray-800"
                onClick={() => setIsCreateDialogOpen(true)}
                disabled={!userData}
                data-testid="button-create-first-list"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create List
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLists.map((list) => (
            <Card
              key={list.id}
              className="border border-gray-200 hover:shadow-md transition-shadow"
              data-testid={`card-list-${list.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-black" data-testid={`text-list-name-${list.id}`}>
                      {list.name}
                    </CardTitle>
                    {list.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2" data-testid={`text-list-description-${list.id}`}>
                        {list.description}
                      </p>
                    )}
                  </div>
                  {list.isShared && (
                    <Share2 className="h-4 w-4 text-gray-400" data-testid={`icon-shared-${list.id}`} />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Share with team</span>
                    <Switch
                      checked={list.isShared}
                      onCheckedChange={(checked) => 
                        toggleShareMutation.mutate({ id: list.id, isShared: checked })
                      }
                      disabled={toggleShareMutation.isPending}
                      data-testid={`toggle-share-${list.id}`}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-black text-black hover:bg-black hover:text-white"
                          onClick={() => setSelectedList(list)}
                          data-testid={`button-view-list-${list.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          View Items
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-semibold">
                            {list.name} - Items
                          </DialogTitle>
                        </DialogHeader>
                        
                        {/* Add Item Form */}
                        <div className="border-b pb-4">
                          <h3 className="font-medium mb-3">Add New Item</h3>
                          <Form {...itemForm}>
                            <form
                              onSubmit={itemForm.handleSubmit((data) => addItemMutation.mutate(data))}
                              className="grid grid-cols-2 gap-3"
                            >
                              <FormField
                                control={itemForm.control}
                                name="productName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Product Name*</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Product name" {...field} data-testid="input-product-name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={itemForm.control}
                                name="sku"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>SKU</FormLabel>
                                    <FormControl>
                                      <Input placeholder="SKU" {...field} data-testid="input-sku" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={itemForm.control}
                                name="quantity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Quantity*</FormLabel>
                                    <FormControl>
                                      <Input type="number" min="1" {...field} data-testid="input-quantity" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={itemForm.control}
                                name="price"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Price*</FormLabel>
                                    <FormControl>
                                      <Input type="number" step="0.01" min="0" {...field} data-testid="input-price" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={itemForm.control}
                                name="notes"
                                render={({ field }) => (
                                  <FormItem className="col-span-2">
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                      <Textarea placeholder="Add notes..." {...field} data-testid="input-notes" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="col-span-2 flex justify-end">
                                <Button
                                  type="submit"
                                  className="bg-black hover:bg-gray-800"
                                  disabled={addItemMutation.isPending}
                                  data-testid="button-add-item"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  {addItemMutation.isPending ? "Adding..." : "Add Item"}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </div>

                        {/* Items List */}
                        <div>
                          <h3 className="font-medium mb-3">Items ({items.length})</h3>
                          {itemsLoading ? (
                            <div className="space-y-2">
                              {[1, 2].map((i) => (
                                <Skeleton key={i} className="h-16" />
                              ))}
                            </div>
                          ) : items.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                              <p>No items in this list yet</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                                  data-testid={`item-${item.id}`}
                                >
                                  <div className="flex-1">
                                    <h4 className="font-medium" data-testid={`text-item-name-${item.id}`}>
                                      {item.productName}
                                    </h4>
                                    {item.sku && (
                                      <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                                    )}
                                    {item.notes && (
                                      <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 border rounded-lg p-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          if (item.quantity > 1) {
                                            updateQuantityMutation.mutate({
                                              id: item.id,
                                              quantity: item.quantity - 1,
                                            });
                                          }
                                        }}
                                        disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                                        className="h-6 w-6 p-0"
                                        data-testid={`button-decrease-${item.id}`}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.id}`}>
                                        {item.quantity}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateQuantityMutation.mutate({
                                            id: item.id,
                                            quantity: item.quantity + 1,
                                          })
                                        }
                                        disabled={updateQuantityMutation.isPending}
                                        className="h-6 w-6 p-0"
                                        data-testid={`button-increase-${item.id}`}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <div className="text-right min-w-[80px]">
                                      <p className="font-semibold" data-testid={`text-price-${item.id}`}>
                                        ${parseFloat(item.price).toFixed(2)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Total: ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteItemMutation.mutate(item.id)}
                                      disabled={deleteItemMutation.isPending}
                                      data-testid={`button-remove-item-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-gray-600 hover:text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(list.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-list-${list.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-gray-600 hover:text-red-600" />
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
