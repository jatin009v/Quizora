import * as XLSX from 'xlsx';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSingleUser, mockUserProfiles, mockAuditLogs } from './userService';

export interface ExcelRowPreview {
  rowNumber: number;
  name: string;
  course: string;
  year: string;
  username: string;
  password?: string; // Kept internal server-side during parse
  isValid: boolean;
  reason?: string;
}

export interface ExcelValidationResult {
  success: boolean;
  error?: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  preview: Omit<ExcelRowPreview, 'password'>[];
  internalValidRows: ExcelRowPreview[]; // Kept server-side
}

export interface BulkExecutionResult {
  success: boolean;
  totalRows: number;
  createdCount: number;
  failedCount: number;
  skippedCount: number;
  errors: Array<{ username: string; name: string; reason: string }>;
}

export async function parseAndValidateExcel(buffer: Buffer): Promise<ExcelValidationResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return {
        success: false,
        error: 'Excel file contains no sheets.',
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        preview: [],
        internalValidRows: [],
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return {
        success: false,
        error: 'Excel file is empty or contains no data rows.',
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        preview: [],
        internalValidRows: [],
      };
    }

    // Inspect headers
    const sample = rawData[0];
    const keys = Object.keys(sample).map((k) => k.toLowerCase().trim());
    const requiredCols = ['name', 'course', 'year', 'username', 'password'];

    const missingCols = requiredCols.filter((col) => !keys.includes(col));
    if (missingCols.length > 0) {
      return {
        success: false,
        error: `Excel header missing required column(s): ${missingCols.join(', ')}. Expected columns: name, course, year, username, password.`,
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        preview: [],
        internalValidRows: [],
      };
    }

    const supabase = createAdminClient();

    // Fetch existing usernames from database
    let existingUsernames = new Set<string>();
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      Array.from(mockUserProfiles.values()).forEach((p) =>
        existingUsernames.add(p.username.toLowerCase())
      );
    } else {
      const { data: dbProfiles } = await supabase.from('profiles').select('username');
      if (dbProfiles) {
        dbProfiles.forEach((p) => existingUsernames.add(p.username.toLowerCase()));
      }
    }

    const fileUsernames = new Set<string>();

    const previewList: Omit<ExcelRowPreview, 'password'>[] = [];
    const internalValidRows: ExcelRowPreview[] = [];

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    rawData.forEach((row, idx) => {
      const rowNum = idx + 2; // Row number in Excel sheet (1 is header)

      // Normalize row keys
      const rowData: Record<string, string> = {};
      Object.keys(row).forEach((k) => {
        rowData[k.toLowerCase().trim()] = String(row[k]).trim();
      });

      const name = rowData['name'] || '';
      const course = rowData['course'] || '';
      const year = rowData['year'] || '1st Year';
      const username = (rowData['username'] || '').toLowerCase();
      const password = rowData['password'] || '';

      let isValid = true;
      let reason = '';

      if (!name || !course || !year || !username || !password) {
        isValid = false;
        reason = 'Missing required field(s)';
      } else if (password.length < 6) {
        isValid = false;
        reason = 'Password must be at least 6 characters';
      } else if (fileUsernames.has(username)) {
        isValid = false;
        reason = 'Duplicate username within Excel file';
        duplicateCount++;
      } else if (existingUsernames.has(username)) {
        isValid = false;
        reason = 'Username already exists in database';
        duplicateCount++;
      }

      if (isValid) {
        fileUsernames.add(username);
        validCount++;

        internalValidRows.push({
          rowNumber: rowNum,
          name,
          course,
          year,
          username,
          password,
          isValid: true,
        });
      } else {
        if (!reason.includes('Duplicate')) invalidCount++;
      }

      previewList.push({
        rowNumber: rowNum,
        name,
        course,
        year,
        username,
        isValid,
        reason,
      });
    });

    return {
      success: true,
      totalRows: rawData.length,
      validCount,
      invalidCount,
      duplicateCount,
      preview: previewList,
      internalValidRows,
    };
  } catch (err: any) {
    console.error('Excel parse error:', err);
    return {
      success: false,
      error: err.message || 'Failed to process Excel file',
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      preview: [],
      internalValidRows: [],
    };
  }
}

export async function executeBulkImport(
  adminProfileId: string,
  rowsToImport: ExcelRowPreview[]
): Promise<BulkExecutionResult> {
  const totalRows = rowsToImport.length;
  let createdCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ username: string; name: string; reason: string }> = [];

  for (const row of rowsToImport) {
    if (!row.isValid || !row.password) {
      skippedCount++;
      continue;
    }

    const res = await createSingleUser(adminProfileId, {
      name: row.name,
      course: row.course,
      year: row.year,
      username: row.username,
      password: row.password,
      role: 'STUDENT',
    });

    if (res.success) {
      createdCount++;
    } else {
      failedCount++;
      errors.push({
        username: row.username,
        name: row.name,
        reason: res.error || 'Creation failed',
      });
    }
  }

  // Audit Log for Bulk Import (ZERO PASSWORDS STORED!)
  const nowIso = new Date().toISOString();
  if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
    mockAuditLogs.push({
      id: `audit-bulk-${Date.now()}`,
      admin_user_id: adminProfileId,
      action: 'BULK_USERS_IMPORTED',
      target_type: 'PROFILES_BATCH',
      metadata: {
        total_rows: totalRows,
        created_count: createdCount,
        failed_count: failedCount,
        skipped_count: skippedCount,
      },
      created_at: nowIso,
    });
  } else {
    const supabase = createAdminClient();
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminProfileId,
      action: 'BULK_USERS_IMPORTED',
      target_type: 'PROFILES_BATCH',
      metadata: {
        total_rows: totalRows,
        created_count: createdCount,
        failed_count: failedCount,
        skipped_count: skippedCount,
      },
      created_at: nowIso,
    });
  }

  return {
    success: true,
    totalRows,
    createdCount,
    failedCount,
    skippedCount,
    errors,
  };
}
