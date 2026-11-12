/**
 * Utility functions for exporting tabular datasets to CSV format.
 * Generates standards-compliant CSV with UTF-8 BOM encoding for seamless Excel/Sheets compatibility.
 */

export interface ExportColumnDef<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

/**
 * Escapes a cell value for CSV format.
 * Wraps strings with commas, quotes, or newlines in quotes, and doubles internal quotes.
 */
export function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports an array of items to a downloadable CSV file.
 * Automatically prepends UTF-8 Byte Order Mark (\uFEFF) so Excel (Windows & Mac),
 * Apple Numbers, and Google Sheets render accent characters (á, é, í, ó, ú, ñ) correctly.
 */
export function exportToCSV<T>(
  filename: string,
  columns: ExportColumnDef<T>[],
  data: T[]
): boolean {
  if (!data || data.length === 0) {
    return false;
  }

  // 1. Build header row
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(',');

  // 2. Build data rows
  const dataRows = data.map((item) => {
    return columns.map((col) => escapeCsvCell(col.accessor(item))).join(',');
  });

  // 3. Prepend UTF-8 BOM (\uFEFF) and join lines with CRLF
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

  // 4. Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return true;
}

