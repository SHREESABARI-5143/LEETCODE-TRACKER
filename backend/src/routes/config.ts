const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    institutionName: process.env.INSTITUTION_NAME || 'Sri Venkateswara Engineering College',
    institutionCode: process.env.INSTITUTION_CODE || 'SVEC',
    departmentCode: process.env.DEPARTMENT_CODE || 'CSE',
    academicYear: process.env.ACADEMIC_YEAR || '2025–26'
  });
});

module.exports = router;
