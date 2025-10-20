// Best Practice: Reusable component for displaying BigCommerce B2B custom fields
// Supports both modern extraFields array and legacy extraInt/extraStr fields
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface CustomField {
  fieldName: string;
  fieldValue: string;
  isRequired?: boolean;
}

interface CustomFieldsDisplayProps {
  // Modern extraFields array (recommended by BigCommerce)
  extraFields?: CustomField[];

  // Legacy string fields (older stores)
  extraStr1?: string | null;
  extraStr2?: string | null;
  extraStr3?: string | null;
  extraStr4?: string | null;
  extraStr5?: string | null;

  // Legacy integer fields (older stores)
  extraInt1?: number | null;
  extraInt2?: number | null;
  extraInt3?: number | null;
  extraInt4?: number | null;
  extraInt5?: number | null;

  // Legacy text field (older stores)
  extraText?: string | null;

  // Additional fields
  referenceNumber?: string | null;

  // Display mode
  variant?: 'full' | 'compact' | 'badge-only';

  // Custom title
  title?: string;
}

/**
 * CustomFieldsDisplay Component
 *
 * Displays BigCommerce B2B Edition custom fields in a professional format.
 * Supports both modern extraFields API and legacy extraInt/extraStr fields.
 *
 * @example
 * // Full display in order detail page
 * <CustomFieldsDisplay
 *   extraFields={order.extraFields}
 *   extraStr1={order.extraStr1}
 *   referenceNumber={order.referenceNumber}
 *   variant="full"
 * />
 *
 * @example
 * // Badge indicator in list view
 * <CustomFieldsDisplay
 *   extraFields={order.extraFields}
 *   variant="badge-only"
 * />
 */
export function CustomFieldsDisplay({
  extraFields = [],
  extraStr1, extraStr2, extraStr3, extraStr4, extraStr5,
  extraInt1, extraInt2, extraInt3, extraInt4, extraInt5,
  extraText,
  referenceNumber,
  variant = 'full',
  title = 'Additional Information',
}: CustomFieldsDisplayProps) {

  // Check if any custom fields exist
  const hasExtraFields = extraFields.length > 0;
  const hasLegacyStrFields = [extraStr1, extraStr2, extraStr3, extraStr4, extraStr5].some(v => v);
  const hasLegacyIntFields = [extraInt1, extraInt2, extraInt3, extraInt4, extraInt5].some(v => v !== null && v !== undefined);
  const hasExtraText = !!extraText;
  const hasReferenceNumber = !!referenceNumber;

  const hasAnyFields = hasExtraFields || hasLegacyStrFields || hasLegacyIntFields || hasExtraText || hasReferenceNumber;

  // Badge-only variant (for list views)
  if (variant === 'badge-only') {
    if (!hasAnyFields) return null;

    const fieldCount = (extraFields?.length || 0) +
      [extraStr1, extraStr2, extraStr3, extraStr4, extraStr5].filter(v => v).length +
      [extraInt1, extraInt2, extraInt3, extraInt4, extraInt5].filter(v => v !== null && v !== undefined).length +
      (extraText ? 1 : 0) +
      (referenceNumber ? 1 : 0);

    return (
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
        <FileText className="h-3 w-3 mr-1" />
        {fieldCount} Custom {fieldCount === 1 ? 'Field' : 'Fields'}
      </Badge>
    );
  }

  // Don't render if no fields exist
  if (!hasAnyFields) return null;

  // Compact variant (minimal styling)
  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        {referenceNumber && (
          <div className="text-sm">
            <span className="text-gray-500">Reference: </span>
            <span className="font-medium">{referenceNumber}</span>
          </div>
        )}

        {hasExtraFields && extraFields.map((field, index) => (
          field.fieldValue && (
            <div key={index} className="text-sm">
              <span className="text-gray-500">{field.fieldName}: </span>
              <span className="font-medium">{field.fieldValue}</span>
            </div>
          )
        ))}

        {[
          { label: 'Extra Field 1', value: extraStr1 },
          { label: 'Extra Field 2', value: extraStr2 },
          { label: 'Extra Field 3', value: extraStr3 },
          { label: 'Extra Field 4', value: extraStr4 },
          { label: 'Extra Field 5', value: extraStr5 },
        ].map((field, index) => (
          field.value && (
            <div key={`str-${index}`} className="text-sm">
              <span className="text-gray-500">{field.label}: </span>
              <span className="font-medium">{field.value}</span>
            </div>
          )
        ))}

        {[
          { label: 'Extra Number 1', value: extraInt1 },
          { label: 'Extra Number 2', value: extraInt2 },
          { label: 'Extra Number 3', value: extraInt3 },
          { label: 'Extra Number 4', value: extraInt4 },
          { label: 'Extra Number 5', value: extraInt5 },
        ].map((field, index) => (
          field.value !== null && field.value !== undefined && (
            <div key={`int-${index}`} className="text-sm">
              <span className="text-gray-500">{field.label}: </span>
              <span className="font-medium">{field.value}</span>
            </div>
          )
        ))}

        {extraText && (
          <div className="text-sm">
            <span className="text-gray-500">Additional Notes: </span>
            <span className="font-medium">{extraText}</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant (card display for detail pages)
  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {referenceNumber && (
          <div>
            <p className="text-sm text-gray-500">Reference Number</p>
            <p className="font-medium" data-testid="reference-number">{referenceNumber}</p>
          </div>
        )}

        {/* Modern extraFields array (recommended) */}
        {hasExtraFields && extraFields.map((field, index) => (
          field.fieldValue && (
            <div key={index}>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                {field.fieldName}
                {field.isRequired && <span className="text-red-500">*</span>}
              </p>
              <p className="font-medium" data-testid={`extra-field-${index}`}>{field.fieldValue}</p>
            </div>
          )
        ))}

        {/* Legacy string fields (backward compatibility) */}
        {[
          { label: 'Extra Field 1', value: extraStr1 },
          { label: 'Extra Field 2', value: extraStr2 },
          { label: 'Extra Field 3', value: extraStr3 },
          { label: 'Extra Field 4', value: extraStr4 },
          { label: 'Extra Field 5', value: extraStr5 },
        ].map((field, index) => (
          field.value && (
            <div key={`str-${index}`}>
              <p className="text-sm text-gray-500">{field.label}</p>
              <p className="font-medium" data-testid={`extra-str-${index + 1}`}>{field.value}</p>
            </div>
          )
        ))}

        {/* Legacy integer fields (backward compatibility) */}
        {[
          { label: 'Extra Number 1', value: extraInt1 },
          { label: 'Extra Number 2', value: extraInt2 },
          { label: 'Extra Number 3', value: extraInt3 },
          { label: 'Extra Number 4', value: extraInt4 },
          { label: 'Extra Number 5', value: extraInt5 },
        ].map((field, index) => (
          field.value !== null && field.value !== undefined && (
            <div key={`int-${index}`}>
              <p className="text-sm text-gray-500">{field.label}</p>
              <p className="font-medium" data-testid={`extra-int-${index + 1}`}>{field.value}</p>
            </div>
          )
        ))}

        {/* Legacy text field (backward compatibility) */}
        {extraText && (
          <div>
            <p className="text-sm text-gray-500">Additional Notes</p>
            <p className="font-medium whitespace-pre-wrap" data-testid="extra-text">{extraText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Hook to check if an order has any custom fields
 * Useful for conditional rendering in list views
 */
export function useHasCustomFields(order: any): boolean {
  if (!order) return false;

  return !!(
    order.extraFields?.length > 0 ||
    order.extraStr1 || order.extraStr2 || order.extraStr3 || order.extraStr4 || order.extraStr5 ||
    order.extraInt1 !== null && order.extraInt1 !== undefined ||
    order.extraInt2 !== null && order.extraInt2 !== undefined ||
    order.extraInt3 !== null && order.extraInt3 !== undefined ||
    order.extraInt4 !== null && order.extraInt4 !== undefined ||
    order.extraInt5 !== null && order.extraInt5 !== undefined ||
    order.extraText ||
    order.referenceNumber
  );
}
