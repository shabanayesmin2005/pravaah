/**
 * Utility to mask vehicle registration numbers for privacy compliance (Analyst role).
 * Transforms:
 *   DL01AB1234 -> DL01****34
 *   MH12CD5678 -> MH12****78
 *   UP32GH7745 -> UP32****45
 */
export function maskPlate(plate: string | null | undefined): string {
  if (!plate || typeof plate !== 'string') return '';
  const trimmed = plate.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 4) return '****';
  if (trimmed.length <= 6) return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`;
}

/**
 * Recursively or deeply masks plate information in an alert document for Analyst users.
 */
export function sanitizeAlertForRole(alertDoc: any, role: string | null | undefined): any {
  if (!alertDoc) return alertDoc;
  const doc = typeof alertDoc.toObject === 'function' ? alertDoc.toObject() : { ...alertDoc };

  if (role === 'Analyst') {
    if (doc.plate_text) {
      const originalPlate = doc.plate_text;
      doc.plate_text = maskPlate(originalPlate);

      // Mask references to the plate in description if present
      if (typeof doc.description === 'string' && originalPlate.length > 3) {
        doc.description = doc.description.split(originalPlate).join(doc.plate_text);
      }
    }

    if (doc.metadata && typeof doc.metadata === 'object') {
      const meta = { ...doc.metadata };
      if (meta.plate_text) {
        meta.plate_text = maskPlate(meta.plate_text);
      }
      doc.metadata = meta;
    }
  }

  return doc;
}
