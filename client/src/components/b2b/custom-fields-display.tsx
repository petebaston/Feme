import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ExtraField {
  name?: string;
  fieldName?: string;
  value?: string;
  fieldValue?: string;
}

interface CustomFieldsDisplayProps {
  extraFields?: ExtraField[];
  title?: string;
  description?: string;
  variant?: 'card' | 'inline' | 'badge';
  className?: string;
}

export function CustomFieldsDisplay({
  extraFields = [],
  title = "Custom Fields",
  description,
  variant = 'card',
  className = '',
}: CustomFieldsDisplayProps) {
  // Handle empty or invalid data
  if (!extraFields || extraFields.length === 0) {
    return null;
  }

  // Normalize field names (handle both 'name' and 'fieldName' formats)
  const normalizedFields = extraFields.map(field => ({
    name: field.name || field.fieldName || 'Unknown',
    value: field.value || field.fieldValue || '',
  })).filter(field => field.value);  // Only show fields with values

  if (normalizedFields.length === 0) {
    return null;
  }

  // Badge variant - small compact display
  if (variant === 'badge') {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {normalizedFields.map((field, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="text-xs font-normal"
          >
            {field.name}: {field.value}
          </Badge>
        ))}
      </div>
    );
  }

  // Inline variant - simple list
  if (variant === 'inline') {
    return (
      <div className={`space-y-2 ${className}`}>
        {normalizedFields.map((field, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">{field.name}:</span>
            <span className="text-gray-900">{field.value}</span>
          </div>
        ))}
      </div>
    );
  }

  // Card variant - full featured display
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {normalizedFields.map((field, index) => (
            <div key={index}>
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-semibold text-gray-900">{field.name}</span>
                <span className="text-sm text-gray-700">{field.value}</span>
              </div>
              {index < normalizedFields.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Utility component to show a badge indicator when custom fields exist
interface CustomFieldsBadgeProps {
  extraFields?: ExtraField[];
  className?: string;
}

export function CustomFieldsBadge({ extraFields, className = '' }: CustomFieldsBadgeProps) {
  const count = extraFields?.filter(f => f.value || f.fieldValue).length || 0;

  if (count === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {count} custom field{count !== 1 ? 's' : ''}
    </Badge>
  );
}
