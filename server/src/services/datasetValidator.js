/**
 * Dataset Validator
 * Utility to validate the structure and content of uploaded CSV datasets.
 */

const REQUIRED_COLUMNS = ["Customer ID", "Invoice", "InvoiceDate", "Quantity", "Price"];

/**
 * Validates the CSV header columns.
 */
export function validateDatasetSchema(headers) {
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Missing required columns: ${missing.join(", ")}`,
      missing
    };
  }
  
  return { isValid: true };
}

/**
 * Basic row-level sanity check.
 */
export function validateDatasetRow(row, index) {
  const errors = [];
  
  if (!row["Customer ID"]) errors.push("Missing Customer ID");
  if (!row["Invoice"]) errors.push("Missing Invoice");
  if (!row["InvoiceDate"]) errors.push("Missing InvoiceDate");
  
  const quantity = parseFloat(row["Quantity"]);
  const price = parseFloat(row["Price"]);
  
  if (isNaN(quantity)) errors.push("Quantity must be a number");
  if (isNaN(price)) errors.push("Price must be a number");
  
  if (errors.length > 0) {
    return {
      isValid: false,
      row: index + 1,
      errors
    };
  }
  
  return { isValid: true };
}
