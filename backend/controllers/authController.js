const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 mins
    });

    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function refreshToken(req, res, next) {
  try {
    const token = req.body.refreshToken || req.headers['x-refresh-token'];
    const result = await authService.refreshToken(token);
    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('token');
    res.json({ success: true, message: 'Successfully logged out.' });
  } catch (err) {
    next(err);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    res.json({
      user: req.user,
      institution: {
        name: process.env.INSTITUTION_NAME || 'Sri Venkateswara Engineering College',
        code: process.env.INSTITUTION_CODE || 'SVEC',
        defaultDepartmentCode: process.env.DEPARTMENT_CODE || 'CSE',
        academicYear: process.env.ACADEMIC_YEAR || '2025–26'
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refreshToken,
  logout,
  getCurrentUser
};
