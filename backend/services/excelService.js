const xlsx = require('xlsx');
const validators = require('../utils/validators');

function autoFitColumns(worksheet, data) {
  if (!data || data.length === 0) return;
  const colWidths = [];
  const keys = Object.keys(data[0]);

  keys.forEach((key) => {
    let maxLen = key.toString().length;
    data.forEach(row => {
      const val = row[key];
      if (val !== null && val !== undefined) {
        const len = val.toString().length;
        if (len > maxLen) maxLen = len;
      }
    });
    colWidths.push({ wch: Math.min(Math.max(maxLen + 4, 12), 65) });
  });

  worksheet['!cols'] = colWidths;
}

function isNilString(str) {
  if (!str) return true;
  const s = String(str).trim().toLowerCase();
  return !s || s === 'nill' || s === 'nil' || s === 'n/a' || s === 'na' || s === 'none' || s === 'null' || s === '0' || s === '-';
}

function cleanStudentName(rawName) {
  if (!rawName) return '';
  let str = String(rawName).trim();
  str = str.replace(/^\d+[\.\-\)]\s*/, '');
  return str;
}

function parseExcelFile(filePath, defaultYear = 1, defaultPlacementStatus = 'Placement') {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(sheet, { raw: false, defval: '' });

  const totalRecords = rows.length;
  const valid = [];
  const invalid = [];
  const duplicates = [];
  const errorReport = [];

  const seenRollNumbers = new Set();

  if (rows.length === 0) {
    return {
      totalRecords: 0,
      valid,
      invalid,
      duplicates,
      errorReport: [{ row: 0, message: 'Excel spreadsheet is empty' }]
    };
  }

  const sampleRow = rows[0];
  const headers = Object.keys(sampleRow);

  const isSNoHeader = (h) => /^\s*(s\.?\s*l?\.?\s*n?o?\.?|sno\.?|s\.?\s*n\.?|serial\.?|#|index|no\.)\s*$/i.test(h.trim());

  let rollKey = headers.find(h => !isSNoHeader(h) && /roll\s*number|roll\s*no|reg\s*no|regno|register\s*number|register\s*no|student\s*id|^roll$/i.test(h.trim()));
  let nameKey = headers.find(h => !isSNoHeader(h) && /student\s*name|^name$|name\s*of\s*the\s*student|student/i.test(h.trim()));
  let usernameKey = headers.find(h => !isSNoHeader(h) && /leetcode\s*id|leetcode\s*username|username|leetcode\s*user|handle/i.test(h.trim()));
  let profileUrlKey = headers.find(h => !isSNoHeader(h) && /profile\s*link|leetcode\s*profile\s*url|profile\s*url|^profile$|link|url/i.test(h.trim()));
  let yearKey = headers.find(h => !isSNoHeader(h) && /^year\s*of\s*study$|^year$|^batch$/i.test(h.trim()));
  let placementKey = headers.find(h => !isSNoHeader(h) && /placement\s*status|placement|category|type|placed/i.test(h.trim()));

  const nonSNoHeaders = headers.filter(h => !isSNoHeader(h));
  if (!rollKey && nonSNoHeaders.length >= 1) rollKey = nonSNoHeaders[0];
  if (!nameKey && nonSNoHeaders.length >= 2) nameKey = nonSNoHeaders[1];
  if (!usernameKey && nonSNoHeaders.length >= 3) usernameKey = nonSNoHeaders[2];
  if (!profileUrlKey && nonSNoHeaders.length >= 4) profileUrlKey = nonSNoHeaders[3];

  if (!rollKey || !nameKey) {
    return {
      totalRecords: 0,
      valid,
      invalid,
      duplicates,
      errorReport: [{ row: 0, message: 'Could not detect required columns: Roll Number, Name' }]
    };
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    let rollNumber = row[rollKey] ? String(row[rollKey]).trim() : '';
    let name = row[nameKey] ? cleanStudentName(row[nameKey]) : '';
    const rawUsername = usernameKey && row[usernameKey] ? String(row[usernameKey]).trim() : '';
    const rawProfileUrl = profileUrlKey && row[profileUrlKey] ? String(row[profileUrlKey]).trim() : '';
    const rawYear = yearKey && row[yearKey] ? row[yearKey] : defaultYear;
    const rawPlacement = placementKey && row[placementKey] ? String(row[placementKey]).trim() : defaultPlacementStatus;

    if (!rollNumber && !name && !rawUsername && !rawProfileUrl) {
      return;
    }

    // Auto-fix if register number is inside Name column
    if (name && (!rollNumber || isSNoHeader(rollKey))) {
      const regPattern = /([0-9]{2}[A-Z0-9]{2,8}[0-9]{2,5})/i;
      const match = name.match(regPattern);
      if (match) {
        rollNumber = match[1].trim();
        name = name.replace(match[0], '').replace(/^[\s\-\:\.\)]+/, '').replace(/[\s\-\:\.\(]+$/, '').trim();
      }
    }

    if (!rollNumber) {
      invalid.push({ row: rowNum, rollNumber, name, reason: 'Missing Roll Number' });
      errorReport.push({ row: rowNum, message: 'Roll Number cannot be empty' });
      return;
    }

    if (!name) {
      invalid.push({ row: rowNum, rollNumber, name, reason: 'Missing Student Name' });
      errorReport.push({ row: rowNum, message: 'Student Name cannot be empty' });
      return;
    }

    const normRoll = rollNumber.toUpperCase();
    if (seenRollNumbers.has(normRoll)) {
      duplicates.push({ row: rowNum, rollNumber, name, reason: 'Duplicate Roll Number in spreadsheet' });
      errorReport.push({ row: rowNum, message: `Duplicate Roll Number: ${rollNumber}` });
      return;
    }
    seenRollNumbers.add(normRoll);

    let parsedHandle = null;
    let finalProfileLink = '';
    const urlValidation = validators.parseProfileUrl(rawProfileUrl || rawUsername);

    if (urlValidation.isValid) {
      parsedHandle = urlValidation.username;
      finalProfileLink = urlValidation.fullUrl;
    } else if (!isNilString(rawUsername)) {
      parsedHandle = rawUsername.trim();
      finalProfileLink = `https://leetcode.com/u/${parsedHandle}/`;
    } else {
      parsedHandle = `NIL_${normRoll}`;
      finalProfileLink = '';
    }

    let parsedYear = parseInt(rawYear, 10);
    if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 4) {
      parsedYear = parseInt(defaultYear, 10) || 1;
    }

    valid.push({
      roll_number: rollNumber,
      name,
      year_of_study: parsedYear,
      placement_status: rawPlacement || 'Placement',
      leetcode_username: parsedHandle,
      profile_link: finalProfileLink,
      sync_status: parsedHandle.startsWith('NIL_') ? 'Failed' : 'Pending'
    });
  });

  return {
    totalRecords,
    valid,
    invalid,
    duplicates,
    errorReport
  };
}

function generateMultiSheetReportExcel({ overall, yearWise, departmentComparison, students, institutionName = process.env.INSTITUTION_NAME || 'Institution' }) {
  const wb = xlsx.utils.book_new();

  // Sheet 1: Overall Summary
  const summaryRows = [
    { 'Metric': 'Institution', 'Value': institutionName },
    { 'Metric': 'Report Generated At', 'Value': new Date().toLocaleString() },
    { 'Metric': 'Total Students', 'Value': overall.totalStudents },
    { 'Metric': 'Active Students', 'Value': overall.activeStudents },
    { 'Metric': 'Active Ratio', 'Value': `${overall.activePercentage}%` },
    { 'Metric': 'Students Analysed', 'Value': overall.analyzedStudents },
    { 'Metric': 'Total Problems Solved', 'Value': overall.totalSolved },
    { 'Metric': 'Average Solved / Student', 'Value': overall.avgSolved },
    { 'Metric': 'Easy Solved', 'Value': overall.difficultyBreakdown?.easy || 0 },
    { 'Metric': 'Medium Solved', 'Value': overall.difficultyBreakdown?.medium || 0 },
    { 'Metric': 'Hard Solved', 'Value': overall.difficultyBreakdown?.hard || 0 },
    { 'Metric': 'Sync Status - Success', 'Value': overall.syncHealth?.Success || 0 },
    { 'Metric': 'Sync Status - Pending', 'Value': overall.syncHealth?.Pending || 0 },
    { 'Metric': 'Sync Status - Failed', 'Value': overall.syncHealth?.Failed || 0 }
  ];
  const summaryWs = xlsx.utils.json_to_sheet(summaryRows);
  autoFitColumns(summaryWs, summaryRows);
  xlsx.utils.book_append_sheet(wb, summaryWs, 'Overall Summary');

  // Sheet 2: Year-wise Performance
  if (yearWise && yearWise.length > 0) {
    const yearRows = yearWise.map(y => ({
      'Year': y.label || `${y.year} Year`,
      'Total Enrolled': y.totalStudents,
      'Active Students': y.activeStudents,
      'Total Solved': y.totalSolved,
      'Average Solved': y.avgSolved,
      'Avg Easy': y.avgEasy,
      'Avg Medium': y.avgMedium,
      'Avg Hard': y.avgHard,
      'Top Coder': y.topStudent ? y.topStudent.name : 'N/A',
      'Top Coder Roll': y.topStudent ? y.topStudent.rollNumber : 'N/A',
      'Top Coder Solved': y.topStudent ? y.topStudent.totalSolved : 'N/A'
    }));
    const yearWs = xlsx.utils.json_to_sheet(yearRows);
    autoFitColumns(yearWs, yearRows);
    xlsx.utils.book_append_sheet(wb, yearWs, 'Year Performance');
  }

  // Sheet 3: Department Comparison (if present)
  if (departmentComparison && departmentComparison.length > 0) {
    const deptRows = departmentComparison.map(d => ({
      'Department': d.name,
      'Code': d.code,
      'Total Students': d.totalStudents,
      'Active Students': d.activeStudents,
      'Total Solved': d.totalSolved,
      'Average Solved': d.avgSolved,
      'Avg Easy': d.avgEasy,
      'Avg Medium': d.avgMedium,
      'Avg Hard': d.avgHard
    }));
    const deptWs = xlsx.utils.json_to_sheet(deptRows);
    autoFitColumns(deptWs, deptRows);
    xlsx.utils.book_append_sheet(wb, deptWs, 'Department Comparison');
  }

  // Sheet 4: Student Details
  if (students && students.length > 0) {
    const studentRows = students.map((s, idx) => ({
      'Rank': idx + 1,
      'Roll Number': s.roll_number,
      'Name': s.name,
      'Year': s.year_of_study ? `${s.year_of_study} Year` : '',
      'Placement Status': s.placement_status || 'Placement',
      'Department': s.department_code || s.department_name || '',
      'LeetCode Handle': s.leetcode_username,
      'Total Solved': s.total_solved || 0,
      'Easy': s.easy_solved || 0,
      'Medium': s.medium_solved || 0,
      'Hard': s.hard_solved || 0,
      'Global Ranking': s.ranking || 'N/A',
      'Sync Status': s.sync_status || 'Pending'
    }));
    const studentWs = xlsx.utils.json_to_sheet(studentRows);
    autoFitColumns(studentWs, studentRows);
    xlsx.utils.book_append_sheet(wb, studentWs, 'Student Directory');
  }

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function generateSampleTemplateExcel() {
  const wb = xlsx.utils.book_new();
  const sampleData = [
    {
      'Roll Number': '2025CS001',
      'Student Name': 'Sample Student A',
      'Year of Study': 1,
      'Placement Status': 'Placement',
      'LeetCode Username': 'tourist',
      'LeetCode Profile URL': 'https://leetcode.com/u/tourist/'
    },
    {
      'Roll Number': '2025CS002',
      'Student Name': 'Sample Student B',
      'Year of Study': 1,
      'Placement Status': 'Placement',
      'LeetCode Username': 'neal_wu',
      'LeetCode Profile URL': 'https://leetcode.com/u/neal_wu/'
    }
  ];

  const ws = xlsx.utils.json_to_sheet(sampleData);
  autoFitColumns(ws, sampleData);
  xlsx.utils.book_append_sheet(wb, ws, 'Student Roster Template');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  parseExcelFile,
  generateMultiSheetReportExcel,
  generateSampleTemplateExcel,
  autoFitColumns
};
