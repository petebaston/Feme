// Best Practice: Component testing for CustomFieldsDisplay
import { render, screen } from '@testing-library/react';
import { CustomFieldsDisplay, useHasCustomFields } from '../custom-fields-display';

describe('CustomFieldsDisplay', () => {
  describe('full variant', () => {
    it('should render modern extraFields array', () => {
      const extraFields = [
        { fieldName: 'Purchase Order', fieldValue: 'PO-12345', isRequired: true },
        { fieldName: 'Cost Center', fieldValue: 'CC-001' },
      ];

      render(<CustomFieldsDisplay extraFields={extraFields} variant="full" />);

      expect(screen.getByText('Purchase Order')).toBeInTheDocument();
      expect(screen.getByText('PO-12345')).toBeInTheDocument();
      expect(screen.getByText('Cost Center')).toBeInTheDocument();
      expect(screen.getByText('CC-001')).toBeInTheDocument();
    });

    it('should render legacy string fields', () => {
      render(
        <CustomFieldsDisplay
          extraStr1="Field 1 Value"
          extraStr3="Field 3 Value"
          variant="full"
        />
      );

      expect(screen.getByText('Extra Field 1')).toBeInTheDocument();
      expect(screen.getByText('Field 1 Value')).toBeInTheDocument();
      expect(screen.getByText('Extra Field 3')).toBeInTheDocument();
      expect(screen.getByText('Field 3 Value')).toBeInTheDocument();
    });

    it('should render legacy integer fields', () => {
      render(
        <CustomFieldsDisplay
          extraInt1={100}
          extraInt2={200}
          variant="full"
        />
      );

      expect(screen.getByText('Extra Number 1')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Extra Number 2')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('should render extraText field', () => {
      render(
        <CustomFieldsDisplay
          extraText="Important notes about this order"
          variant="full"
        />
      );

      expect(screen.getByText('Additional Notes')).toBeInTheDocument();
      expect(screen.getByText('Important notes about this order')).toBeInTheDocument();
    });

    it('should render reference number', () => {
      render(
        <CustomFieldsDisplay
          referenceNumber="REF-2024-001"
          variant="full"
        />
      );

      expect(screen.getByText('Reference Number')).toBeInTheDocument();
      expect(screen.getByText('REF-2024-001')).toBeInTheDocument();
    });

    it('should render custom title', () => {
      render(
        <CustomFieldsDisplay
          extraStr1="Test"
          variant="full"
          title="Custom Title"
        />
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should handle mixed modern and legacy fields', () => {
      const extraFields = [
        { fieldName: 'Project Code', fieldValue: 'PROJ-001' },
      ];

      render(
        <CustomFieldsDisplay
          extraFields={extraFields}
          extraStr1="Legacy String"
          extraInt1={999}
          extraText="Additional info"
          referenceNumber="REF-001"
          variant="full"
        />
      );

      expect(screen.getByText('Project Code')).toBeInTheDocument();
      expect(screen.getByText('PROJ-001')).toBeInTheDocument();
      expect(screen.getByText('Extra Field 1')).toBeInTheDocument();
      expect(screen.getByText('Legacy String')).toBeInTheDocument();
      expect(screen.getByText('Extra Number 1')).toBeInTheDocument();
      expect(screen.getByText('999')).toBeInTheDocument();
      expect(screen.getByText('Additional Notes')).toBeInTheDocument();
      expect(screen.getByText('Additional info')).toBeInTheDocument();
      expect(screen.getByText('Reference Number')).toBeInTheDocument();
      expect(screen.getByText('REF-001')).toBeInTheDocument();
    });

    it('should not render when no fields exist', () => {
      const { container } = render(<CustomFieldsDisplay variant="full" />);
      expect(container.firstChild).toBeNull();
    });

    it('should skip empty extraFields', () => {
      const extraFields = [
        { fieldName: 'Empty Field', fieldValue: '' },
        { fieldName: 'Valid Field', fieldValue: 'Value' },
      ];

      render(<CustomFieldsDisplay extraFields={extraFields} variant="full" />);

      expect(screen.queryByText('Empty Field')).not.toBeInTheDocument();
      expect(screen.getByText('Valid Field')).toBeInTheDocument();
    });

    it('should mark required fields with asterisk', () => {
      const extraFields = [
        { fieldName: 'Required Field', fieldValue: 'Value', isRequired: true },
      ];

      render(<CustomFieldsDisplay extraFields={extraFields} variant="full" />);

      const fieldLabel = screen.getByText(/Required Field/);
      expect(fieldLabel.parentElement?.textContent).toContain('*');
    });
  });

  describe('compact variant', () => {
    it('should render in compact format', () => {
      render(
        <CustomFieldsDisplay
          referenceNumber="REF-001"
          extraStr1="Test Value"
          variant="compact"
        />
      );

      expect(screen.getByText(/Reference:/)).toBeInTheDocument();
      expect(screen.getByText('REF-001')).toBeInTheDocument();
      expect(screen.getByText(/Extra Field 1:/)).toBeInTheDocument();
      expect(screen.getByText('Test Value')).toBeInTheDocument();
    });

    it('should not render card wrapper in compact mode', () => {
      const { container } = render(
        <CustomFieldsDisplay
          extraStr1="Test"
          variant="compact"
        />
      );

      // Should not have Card component classes
      expect(container.querySelector('[class*="border-gray-200"]')).toBeNull();
    });
  });

  describe('badge-only variant', () => {
    it('should render badge with field count', () => {
      render(
        <CustomFieldsDisplay
          extraStr1="Field 1"
          extraStr2="Field 2"
          extraInt1={100}
          variant="badge-only"
        />
      );

      expect(screen.getByText('3 Custom Fields')).toBeInTheDocument();
    });

    it('should render singular "Field" for single field', () => {
      render(
        <CustomFieldsDisplay
          extraStr1="Single Field"
          variant="badge-only"
        />
      );

      expect(screen.getByText('1 Custom Field')).toBeInTheDocument();
    });

    it('should not render when no fields exist', () => {
      const { container } = render(<CustomFieldsDisplay variant="badge-only" />);
      expect(container.firstChild).toBeNull();
    });

    it('should count all field types', () => {
      const extraFields = [
        { fieldName: 'Field 1', fieldValue: 'Value 1' },
        { fieldName: 'Field 2', fieldValue: 'Value 2' },
      ];

      render(
        <CustomFieldsDisplay
          extraFields={extraFields}
          extraStr1="String 1"
          extraInt1={100}
          extraText="Text field"
          referenceNumber="REF-001"
          variant="badge-only"
        />
      );

      expect(screen.getByText('6 Custom Fields')).toBeInTheDocument();
    });
  });

  describe('field filtering', () => {
    it('should not render null integer fields', () => {
      render(
        <CustomFieldsDisplay
          extraInt1={null}
          extraInt2={0}
          extraInt3={100}
          variant="full"
        />
      );

      // extraInt1 (null) should not render
      expect(screen.queryByText('Extra Number 1')).not.toBeInTheDocument();

      // extraInt2 (0) should render (0 is a valid value)
      expect(screen.getByText('Extra Number 2')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();

      // extraInt3 should render
      expect(screen.getByText('Extra Number 3')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should not render empty string fields', () => {
      render(
        <CustomFieldsDisplay
          extraStr1=""
          extraStr2="Valid"
          variant="full"
        />
      );

      expect(screen.queryByText('Extra Field 1')).not.toBeInTheDocument();
      expect(screen.getByText('Extra Field 2')).toBeInTheDocument();
    });

    it('should not render undefined fields', () => {
      render(
        <CustomFieldsDisplay
          extraStr1={undefined}
          extraInt1={undefined}
          variant="full"
        />
      );

      expect(screen.queryByText('Extra Field 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Extra Number 1')).not.toBeInTheDocument();
    });
  });

  describe('data-testid attributes', () => {
    it('should have testids for modern extraFields', () => {
      const extraFields = [
        { fieldName: 'Field 1', fieldValue: 'Value 1' },
        { fieldName: 'Field 2', fieldValue: 'Value 2' },
      ];

      render(<CustomFieldsDisplay extraFields={extraFields} variant="full" />);

      expect(screen.getByTestId('extra-field-0')).toBeInTheDocument();
      expect(screen.getByTestId('extra-field-1')).toBeInTheDocument();
    });

    it('should have testids for legacy string fields', () => {
      render(
        <CustomFieldsDisplay
          extraStr1="Value 1"
          extraStr2="Value 2"
          variant="full"
        />
      );

      expect(screen.getByTestId('extra-str-1')).toBeInTheDocument();
      expect(screen.getByTestId('extra-str-2')).toBeInTheDocument();
    });

    it('should have testids for legacy integer fields', () => {
      render(
        <CustomFieldsDisplay
          extraInt1={100}
          extraInt2={200}
          variant="full"
        />
      );

      expect(screen.getByTestId('extra-int-1')).toBeInTheDocument();
      expect(screen.getByTestId('extra-int-2')).toBeInTheDocument();
    });

    it('should have testid for extraText', () => {
      render(<CustomFieldsDisplay extraText="Test text" variant="full" />);
      expect(screen.getByTestId('extra-text')).toBeInTheDocument();
    });

    it('should have testid for reference number', () => {
      render(<CustomFieldsDisplay referenceNumber="REF-001" variant="full" />);
      expect(screen.getByTestId('reference-number')).toBeInTheDocument();
    });
  });
});

describe('useHasCustomFields hook', () => {
  it('should return true when extraFields exist', () => {
    const order = { extraFields: [{ fieldName: 'Field', fieldValue: 'Value' }] };
    expect(useHasCustomFields(order)).toBe(true);
  });

  it('should return true when legacy string fields exist', () => {
    const order = { extraStr1: 'Value' };
    expect(useHasCustomFields(order)).toBe(true);
  });

  it('should return true when legacy integer fields exist', () => {
    const order = { extraInt1: 100 };
    expect(useHasCustomFields(order)).toBe(true);
  });

  it('should return true when extraText exists', () => {
    const order = { extraText: 'Text' };
    expect(useHasCustomFields(order)).toBe(true);
  });

  it('should return true when reference number exists', () => {
    const order = { referenceNumber: 'REF-001' };
    expect(useHasCustomFields(order)).toBe(true);
  });

  it('should return false when no fields exist', () => {
    const order = {};
    expect(useHasCustomFields(order)).toBe(false);
  });

  it('should return false when fields are null/undefined', () => {
    const order = {
      extraFields: [],
      extraStr1: null,
      extraInt1: undefined,
      extraText: null,
      referenceNumber: null,
    };
    expect(useHasCustomFields(order)).toBe(false);
  });

  it('should return false when order is null', () => {
    expect(useHasCustomFields(null)).toBe(false);
  });

  it('should return false when order is undefined', () => {
    expect(useHasCustomFields(undefined)).toBe(false);
  });

  it('should handle zero as a valid integer value', () => {
    const order = { extraInt1: 0 };
    expect(useHasCustomFields(order)).toBe(true);
  });
});
