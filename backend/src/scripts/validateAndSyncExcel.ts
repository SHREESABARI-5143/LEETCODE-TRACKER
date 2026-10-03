import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { prisma } from '../config/prisma';

function cleanCell(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.text) return String(val.text).trim();
    if (val.result) return String(val.result).trim();
    if (val.hyperlink) return String(val.hyperlink).trim();
    return '';
  }
  return String(val).trim();
}

function cleanUsername(rawUser: string, rawUrl: string): string {
  let user = cleanCell(rawUser);
  if (!user && rawUrl) {
    const cleanUrl = cleanCell(rawUrl);
    const match = cleanUrl.match(/leetcode\.com\/(?:u\/)?([^\/\?#]+)/i);
    if (match) user = match[1];
  }
  user = user.replace(/^https?:\/\/leetcode\.com\/(?:u\/)?/i, '').replace(/\/+$/, '').trim();
  return user;
}

export async function validateAndSyncFromExcel() {
  const filePath = path.join(__dirname, '..', '..', 'data', '2027 Leetcode UserName with Profile.xlsx');
  console.log(`\n======================================================`);
  console.log(`  Validating Students against: ${filePath}`);
  console.log(`======================================================`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  interface ExcelStudent {
    sno: number;
    regNo: string;
    name: string;
    username: string;
    profileUrl: string;
  }

  const excelStudents: ExcelStudent[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip Header

    const snoRaw = cleanCell(row.getCell(1).value);
    const sno = parseInt(snoRaw);
    const regNo = cleanCell(row.getCell(2).value);
    const name = cleanCell(row.getCell(3).value);
    const rawUser = cleanCell(row.getCell(4).value);
    const rawProfile = cleanCell(row.getCell(5).value);

    if (regNo && name) {
      const username = cleanUsername(rawUser, rawProfile);
      const profileUrl = rawProfile || (username ? `https://leetcode.com/u/${username}/` : '');
      excelStudents.push({
        sno: isNaN(sno) ? excelStudents.length + 1 : sno,
        regNo: regNo.toUpperCase(),
        name,
        username,
        profileUrl,
      });
    }
  });

  console.log(`Total valid student rows parsed from Excel: ${excelStudents.length}`);

  // Fetch all students currently in DB
  const dbStudents = await prisma.student.findMany({
    include: { profile: true },
  });
  console.log(`Total students currently in Database: ${dbStudents.length}`);

  const dbByRegNo = new Map<string, typeof dbStudents[0]>();
  for (const s of dbStudents) {
    dbByRegNo.set(s.registerNumber.toUpperCase(), s);
  }

  let matched = 0;
  let updated = 0;
  let inserted = 0;
  const discrepancyList: any[] = [];

  for (const es of excelStudents) {
    const existing = dbByRegNo.get(es.regNo);
    if (!existing) {
      // Create new student
      await prisma.student.create({
        data: {
          registerNumber: es.regNo,
          name: es.name,
          collegeEmail: `${es.regNo.toLowerCase()}@svec.edu.in`,
          year: 4,
          section: 'A',
          batch: '2023-2027',
          leetcodeUsername: es.username,
          leetcodeProfileUrl: es.profileUrl,
          status: 'active',
        },
      });
      inserted++;
      discrepancyList.push({
        type: 'INSERTED_MISSING',
        regNo: es.regNo,
        name: es.name,
        username: es.username,
      });
    } else {
      // Check differences in Name, Username, or Profile URL
      const nameDiff = existing.name.trim() !== es.name.trim();
      const userDiff = existing.leetcodeUsername?.trim() !== es.username?.trim();
      const urlDiff = existing.leetcodeProfileUrl?.trim() !== es.profileUrl?.trim();

      if (nameDiff || userDiff || urlDiff) {
        await prisma.student.update({
          where: { id: existing.id },
          data: {
            name: es.name,
            leetcodeUsername: es.username,
            leetcodeProfileUrl: es.profileUrl,
          },
        });
        updated++;
        discrepancyList.push({
          type: 'UPDATED_MISMATCH',
          regNo: es.regNo,
          diff: {
            ...(nameDiff ? { name: { db: existing.name, excel: es.name } } : {}),
            ...(userDiff ? { username: { db: existing.leetcodeUsername, excel: es.username } } : {}),
            ...(urlDiff ? { profileUrl: { db: existing.leetcodeProfileUrl, excel: es.profileUrl } } : {}),
          },
        });
      } else {
        matched++;
      }
    }
  }

  // Also check for any DB students that do NOT exist in the Excel sheet
  const excelRegNos = new Set(excelStudents.map((e) => e.regNo));
  const orphans = dbStudents.filter((s) => !excelRegNos.has(s.registerNumber.toUpperCase()));

  console.log(`\n======================================================`);
  console.log(`  VALIDATION & UPDATE RESULTS`);
  console.log(`======================================================`);
  console.log(`✓ Total Excel Students Checked: ${excelStudents.length}`);
  console.log(`✓ 100% Matches (Already Valid):  ${matched}`);
  console.log(`✓ Updated Mismatches:           ${updated}`);
  console.log(`✓ Newly Inserted Missing:       ${inserted}`);
  console.log(`✓ DB Records Not in Excel:      ${orphans.length}`);

  if (discrepancyList.length > 0) {
    console.log(`\nDetailed Discrepancies Fixed (${discrepancyList.length}):`);
    console.log(JSON.stringify(discrepancyList.slice(0, 20), null, 2));
    if (discrepancyList.length > 20) {
      console.log(`... and ${discrepancyList.length - 20} more updated.`);
    }
  }

  // Also update students_4th_year.json in project root and frontend so mock/fallback data stays in sync
  const rootJsonPath = path.join(__dirname, '..', '..', 'data', 'students_4th_year.json');
  const frontendJsonPath = path.join(__dirname, '..', '..', '..', 'frontend', 'students_4th_year.json');
  const jsonContent = JSON.stringify(excelStudents, null, 2);

  fs.writeFileSync(rootJsonPath, jsonContent);
  console.log(`✓ Updated ${rootJsonPath}`);

  if (fs.existsSync(path.dirname(frontendJsonPath))) {
    fs.writeFileSync(frontendJsonPath, jsonContent);
    console.log(`✓ Updated ${frontendJsonPath}`);
  }

  console.log(`\nALL NAMES AND USERNAMES ARE NOW 100% VALIDATED & MATCHED WITH EXCEL!`);
}

if (require.main === module) {
  validateAndSyncFromExcel()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Validation error:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
