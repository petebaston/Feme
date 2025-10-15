import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ShoppingCart, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuickOrderRow {
  id: string;
  sku: string;
  quantity: number;
  productName?: string;
  price?: number;
  available?: boolean;
  error?: string;
}

export default function QuickOrder() {
  const { toast } = useToast();
  const [rows, setRows] = useState<QuickOrderRow[]>([
    { id: '1', sku: '', quantity: 1 },
    { id: '2', sku: '', quantity: 1 },
    { id: '3', sku: '', quantity: 1 },
  ]);

  const addToCartMutation = useMutation({
    mutationFn: async (items: QuickOrderRow[]) => {
      // Filter valid items with SKUs
      const validItems = items.filter(item => item.sku && item.quantity > 0);
      
      if (validItems.length === 0) {
        throw new Error('No valid items to add');
      }

      // In production, this would call BigCommerce cart API
      const response = await apiRequest("POST", "/api/cart/items", {
        items: validItems.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to Cart",
        description: `Successfully added ${rows.filter(r => r.sku).length} items to your cart`,
      });
      // Reset rows
      setRows([
        { id: Date.now().toString(), sku: '', quantity: 1 },
        { id: (Date.now() + 1).toString(), sku: '', quantity: 1 },
        { id: (Date.now() + 2).toString(), sku: '', quantity: 1 },
      ]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add items to cart",
        variant: "destructive",
      });
    },
  });

  const handleAddRow = () => {
    setRows([...rows, { id: Date.now().toString(), sku: '', quantity: 1 }]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handleUpdateRow = (id: string, field: 'sku' | 'quantity', value: string | number) => {
    setRows(rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handlePasteData = (e: React.ClipboardEvent<HTMLInputElement>, rowId: string) => {
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText.split('\n').filter(line => line.trim());
    
    if (lines.length > 1) {
      e.preventDefault();
      
      // Parse pasted data (assume format: SKU\tQuantity or SKU,Quantity)
      const newRows = lines.map((line, index) => {
        const parts = line.split(/[\t,]/).map(p => p.trim());
        return {
          id: (Date.now() + index).toString(),
          sku: parts[0] || '',
          quantity: parseInt(parts[1]) || 1,
        };
      });
      
      // Replace current rows with pasted data
      setRows(newRows);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row if present
      const dataLines = lines[0].toLowerCase().includes('sku') ? lines.slice(1) : lines;
      
      const newRows = dataLines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim().replace(/['"]/g, ''));
        return {
          id: (Date.now() + index).toString(),
          sku: parts[0] || '',
          quantity: parseInt(parts[1]) || 1,
        };
      }).filter(row => row.sku);

      if (newRows.length > 0) {
        setRows(newRows);
        toast({
          title: "CSV Imported",
          description: `Loaded ${newRows.length} items from CSV`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csv = "SKU,Quantity\nEXAMPLE-SKU-1,10\nEXAMPLE-SKU-2,5";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quick-order-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-black">Quick Order</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Enter SKUs and quantities for rapid ordering</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="border-gray-300"
            data-testid="button-download-template"
          >
            <Download className="w-4 h-4 mr-2" />
            Template
          </Button>
          <label>
            <Button
              variant="outline"
              className="border-gray-300"
              data-testid="button-upload-csv"
              asChild
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </span>
            </Button>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Instructions */}
      <Card className="border border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">Quick Tips:</p>
            <ul className="space-y-1 text-gray-700 list-disc list-inside">
              <li>Enter product SKUs and quantities directly</li>
              <li>Paste from Excel/CSV (SKU in column 1, quantity in column 2)</li>
              <li>Upload a CSV file with SKU and Quantity columns</li>
              <li>Click "Add Row" to add more items</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Quick Order Table */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[200px]">SKU / Product Code</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-gray-500">{index + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={row.sku}
                        onChange={(e) => handleUpdateRow(row.id, 'sku', e.target.value.toUpperCase())}
                        onPaste={(e) => handlePasteData(e, row.id)}
                        placeholder="Enter SKU"
                        className="font-mono border-gray-300 focus:border-black focus:ring-black"
                        data-testid={`input-sku-${index}`}
                      />
                      {row.error && (
                        <p className="text-xs text-red-600 mt-1">{row.error}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleUpdateRow(row.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="border-gray-300 focus:border-black focus:ring-black"
                        data-testid={`input-quantity-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={rows.length === 1}
                        className="text-gray-500 hover:text-red-600"
                        data-testid={`button-remove-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleAddRow}
              className="border-gray-300"
              data-testid="button-add-row"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Row
            </Button>

            <Button
              onClick={() => addToCartMutation.mutate(rows)}
              disabled={addToCartMutation.isPending || rows.every(r => !r.sku)}
              className="bg-black text-white hover:bg-gray-800"
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {addToCartMutation.isPending ? 'Adding...' : `Add to Cart (${rows.filter(r => r.sku).length})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
