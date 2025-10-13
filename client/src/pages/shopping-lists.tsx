import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ShoppingCart, Trash2, Share2, Package, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertShoppingListSchema, type ShoppingList } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";

const createListSchema = insertShoppingListSchema.extend({
  name: z.string().min(1, "Name is required"),
  companyId: z.string().default("demo-company"),
  userId: z.string().default("demo-user"),
  status: z.string().default("active"),
  isShared: z.boolean().default(false),
});

export default function ShoppingLists() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: lists = [], isLoading } = useQuery<ShoppingList[]>({
    queryKey: ["/api/shopping-lists"],
  });

  const form = useForm({
    resolver: zodResolver(createListSchema),
    defaultValues: {
      name: "",
      description: "",
      companyId: "demo-company",
      userId: "demo-user",
      status: "active",
      isShared: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createListSchema>) => {
      const response = await apiRequest("POST", "/api/shopping-lists", data);
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
            <Button className="bg-black hover:bg-gray-800" data-testid="button-create-list">
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
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-black text-black hover:bg-black hover:text-white"
                      data-testid={`button-view-list-${list.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      View Items
                    </Button>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
