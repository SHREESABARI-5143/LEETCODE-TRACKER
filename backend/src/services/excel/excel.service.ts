import ExcelJS from 'exceljs';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { Readable } from 'stream';

export interface RowError {
  row: number;
  errors: string[];
}

export interface ImportPreviewRow {
  registerNumber: string;
  name: string;
  collegeEmail: string;
  year: number;
  section: string;
  batch: string;
  proctorName: string;
  leetcodeUsername: string;
  valid: boolean;
  errors: string[];
}

function getCellValue(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if ('text' in cell.value) return String(cell.value.text).trim();
    if ('result' in cell.value) return String(cell.value.result).trim();
    if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
      return (cell.value as any).richText.map((rt: any) => rt.text).join('').trim();
    }
  }
  return String(cell.value).trim();
}

function extractUsernameFromUrl(val: string): string {
  let clean = val.trim();
  if (!clean) return '';
  if (clean.includes('leetcode.com')) {
    const parts = clean.replace(/\/$/, '').split('/');
    const last = parts[parts.length - 1];
    if (last && last !== 'u') {
      clean = last;
    } else if (parts.length >= 2) {
      clean = parts[parts.length - 2];
    }
  }
  return clean;
}

export class ExcelService {
  public static async parseStudentExcel(
    buffer: Buffer,
    expectedYear?: number
  ): Promise<{ preview: ImportPreviewRow[]; total: number; validCount: number; invalidCount: number }> {
    const workbook = new ExcelJS.Workbook();
    
    // Try XLSX parsing first, fallback to CSV parsing if fails
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (xlsxErr) {
      try {
        const stream = Readable.from(buffer);
        await workbook.csv.read(stream);
      } catch (csvErr) {
        logger.error({ xlsxErr, csvErr }, 'Failed to parse file as XLSX or CSV');
        throw new Error('Failed to parse uploaded file. Please ensure it is a valid Excel (.xlsx/.xls) or CSV file.');
      }
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Worksheet not found in Excel workbook');
    }

    const preview: ImportPreviewRow[] = [];
    const seenRegNos = new Set<string>();
    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();

    // Fetch existing records from database for validation checking
    const existingStudents = await prisma.student.findMany({
      select: { registerNumber: true, collegeEmail: true, leetcodeUsername: true },
    });
    const dbRegNos = new Set(existingStudents.map(s => s.registerNumber.toLowerCase()));
    const dbEmails = new Set(existingStudents.map(s => s.collegeEmail.toLowerCase()));
    const dbUsernames = new Set(existingStudents.map(s => s.leetcodeUsername.toLowerCase()));

    // Get proctors from database to validate existence
    const dbProctors = await prisma.proctor.findMany({ select: { id: true, name: true } });

    // Dynamic Header Detection on Row 1
    let colRegNo = -1;
    let colName = -1;
    let colEmail = -1;
    let colYear = -1;
    let colSection = -1;
    let colBatch = -1;
    let colProctor = -1;
    let colUsername = -1;

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const txt = getCellValue(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!txt) return;

      // Skip profile link headers from matching username
      if (['profile', 'url', 'link'].some(k => txt.includes(k))) {
        return;
      }

      if (['regno', 'registernumber', 'registerno', 'rollno', 'register'].some(k => txt.includes(k))) {
        colRegNo = colNumber;
      } else if (['name', 'studentname', 'fullname'].some(k => txt.includes(k)) && !txt.includes('user')) {
        colName = colNumber;
      } else if (['username', 'leetcodeusername', 'lcusername', 'user', 'handle', 'leetcode'].some(k => txt.includes(k))) {
        if (colUsername === -1) colUsername = colNumber;
      } else if (['email', 'collegeemail', 'emailid', 'mail'].some(k => txt.includes(k))) {
        colEmail = colNumber;
      } else if (['year', 'academicyear'].some(k => txt.includes(k))) {
        colYear = colNumber;
      } else if (['section', 'sec'].some(k => txt.includes(k))) {
        colSection = colNumber;
      } else if (['batch', 'batchyear'].some(k => txt.includes(k))) {
        colBatch = colNumber;
      } else if (['proctor', 'proctorname'].some(k => txt.includes(k))) {
        colProctor = colNumber;
      }
    });

    // Fallbacks if standard headers were not explicitly matched by index
    if (colRegNo === -1) colRegNo = 1;
    if (colName === -1) colName = colRegNo === 1 ? 2 : 1;
    if (colUsername === -1) colUsername = colEmail !== -1 ? (colEmail === 3 ? 4 : 8) : 4;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const errors: string[] = [];

      const regNo = colRegNo > 0 ? getCellValue(row.getCell(colRegNo)) : '';
      const name = colName > 0 ? getCellValue(row.getCell(colName)) : '';
      let email = colEmail > 0 ? getCellValue(row.getCell(colEmail)) : '';
      const yearStr = colYear > 0 ? getCellValue(row.getCell(colYear)) : '';
      let section = colSection > 0 ? getCellValue(row.getCell(colSection)).toUpperCase() : '';
      let batch = colBatch > 0 ? getCellValue(row.getCell(colBatch)) : '';
      const proctorName = colProctor > 0 ? getCellValue(row.getCell(colProctor)) : '';
      const rawUsername = colUsername > 0 ? getCellValue(row.getCell(colUsername)) : '';
      const leetcodeUsername = extractUsernameFromUrl(rawUsername);

      // Skip completely empty rows
      if (!regNo && !name && !leetcodeUsername) {
        return;
      }

      // Year resolution: if expectedYear is provided, enforce expectedYear
      let year = expectedYear !== undefined ? expectedYear : parseInt(yearStr);
      if (isNaN(year) || year < 1 || year > 4) {
        year = expectedYear !== undefined ? expectedYear : 1;
      }

      // Fallback email generator if omitted
      if (!email && regNo) {
        email = `${regNo.toLowerCase()}@svec.edu.in`;
      } else if (!email && leetcodeUsername) {
        email = `${leetcodeUsername.toLowerCase()}@svec.edu.in`;
      }

      // Fallback section & batch
      if (!section) section = 'A';
      if (!batch) batch = '2023-2027';

      // Validation logic
      if (!regNo) errors.push('Missing Register Number');
      if (!name) errors.push('Missing Student Name');
      if (!email) {
        errors.push('Missing College Email');
      } else if (!email.includes('@')) {
        errors.push('Invalid email format');
      }

      if (expectedYear !== undefined && year !== expectedYear) {
        errors.push(`Year ${year} does not match expected import year ${expectedYear}`);
      }

      if (!leetcodeUsername) errors.push('Missing LeetCode Username');

      // Check duplicates in the Excel file
      if (regNo && seenRegNos.has(regNo.toLowerCase())) {
        errors.push(`Duplicate Register Number in sheet: ${regNo}`);
      } else if (regNo) {
        seenRegNos.add(regNo.toLowerCase());
      }

      if (email && seenEmails.has(email.toLowerCase())) {
        errors.push(`Duplicate Email in sheet: ${email}`);
      } else if (email) {
        seenEmails.add(email.toLowerCase());
      }

      if (leetcodeUsername && seenUsernames.has(leetcodeUsername.toLowerCase())) {
        errors.push(`Duplicate LeetCode Username in sheet: ${leetcodeUsername}`);
      } else if (leetcodeUsername) {
        seenUsernames.add(leetcodeUsername.toLowerCase());
      }

      // Check duplicates against existing database records
      if (regNo && dbRegNos.has(regNo.toLowerCase())) {
        errors.push(`Register Number already exists in database: ${regNo}`);
      }
      if (email && dbEmails.has(email.toLowerCase())) {
        errors.push(`College Email already exists in database: ${email}`);
      }
      if (leetcodeUsername && dbUsernames.has(leetcodeUsername.toLowerCase())) {
        errors.push(`LeetCode Username already exists in database: ${leetcodeUsername}`);
      }

      // Validate Proctor assignment
      if (proctorName) {
        const found = dbProctors.find(p => p.name.toLowerCase() === proctorName.toLowerCase());
        if (!found) {
          errors.push(`Proctor not found: ${proctorName}`);
        }
      }

      preview.push({
        registerNumber: regNo,
        name,
        collegeEmail: email,
        year,
        section,
        batch,
        proctorName,
        leetcodeUsername,
        valid: errors.length === 0,
        errors,
      });
    });

    const validCount = preview.filter(p => p.valid).length;
    const invalidCount = preview.length - validCount;

    return {
      preview,
      total: preview.length,
      validCount,
      invalidCount,
    };
  }
}
