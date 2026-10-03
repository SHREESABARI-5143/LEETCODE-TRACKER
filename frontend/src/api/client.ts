/**
 * Native fetch-based API client for CodeTrack
 * Works seamlessly in Vite dev and production without external bundle resolution issues.
 */

function getAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const authStorage = localStorage.getItem('codetrack-auth-v2');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      const token = parsed?.state?.token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (e) {}
  return headers;
}

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  // Do not set Content-Type for FormData uploads (browser sets multipart boundary)
  if (options.body instanceof FormData) {
    delete (headers as any)['Content-Type'];
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token refresh on 401
  if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    try {
      const authStorage = localStorage.getItem('codetrack-auth-v2');
      const parsed = authStorage ? JSON.parse(authStorage) : null;
      const refreshToken = parsed?.state?.refreshToken;

      if (refreshToken) {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData?.accessToken && parsed?.state) {
            parsed.state.token = refreshData.accessToken;
            parsed.state.refreshToken = refreshData.refreshToken || refreshToken;
            localStorage.setItem('codetrack-auth-v2', JSON.stringify(parsed));

            // Retry original request with new token
            return request(url, options);
          }
        } else {
          // Force logout
          localStorage.removeItem('codetrack-auth-v2');
          window.location.href = '/login';
          return { data: null, status: 401 };
        }
      } else {
        localStorage.removeItem('codetrack-auth-v2');
        window.location.href = '/login';
        return { data: null, status: 401 };
      }
    } catch (e) {
      localStorage.removeItem('codetrack-auth-v2');
      window.location.href = '/login';
      return { data: null, status: 401 };
    }
  }

  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument')) {
    data = await res.arrayBuffer();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorObj: any = new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
    errorObj.response = { status: res.status, data };
    throw errorObj;
  }

  return { data, status: res.status };
}

export const authApi = {
  login: (email: string, password: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request('/api/auth/logout', {
      method: 'POST',
    }),
  getMe: () => request('/api/auth/me'),
};

export const reportsApi = {
  getOverall: (params?: any) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/reports/overall${query}`);
  },
  getYearWise: (params?: any) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/reports/year-wise${query}`);
  },
  getDepartmentComparison: () => request('/api/reports/department-comparison'),
  getDailyPerformers: (period = 'today') =>
    request(`/api/reports/daily-performers?period=${encodeURIComponent(period)}`),
  getExportUrl: () => '/api/reports/export',
};

export const studentsApi = {
  getStudents: (params?: any) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/students${query}`);
  },
  getStudentById: (id: string | number) => request(`/api/students/${id}`),
  updateStudent: (id: string | number, data: any) =>
    request(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  assignProctor: (id: string | number, proctorId: number | null) =>
    request(`/api/students/${id}/assign-proctor`, {
      method: 'PUT',
      body: JSON.stringify({ proctor_id: proctorId }),
    }),
  syncStudent: (id: string | number) =>
    request(`/api/students/${id}/sync`, {
      method: 'POST',
    }),

  /**
   * Start a background sync for all (or year-filtered) students.
   * Returns immediately with { taskId, total, status: 'processing' }.
   */
  syncAll: (year?: number) =>
    request('/api/students/sync-all', {
      method: 'POST',
      body: year ? JSON.stringify({ year }) : undefined,
    }),

  /**
   * Alias: refresh all students (same as syncAll).
   */
  refreshAll: (year?: number) =>
    request('/api/students/refresh-all', {
      method: 'POST',
      body: year ? JSON.stringify({ year }) : undefined,
    }),

  /**
   * Poll the status of an in-progress background sync task.
   */
  getSyncStatus: (taskId: string) =>
    request(`/api/students/sync-status/${taskId}`),

  getRefreshStatus: (taskId: string) =>
    request(`/api/students/refresh-status/${taskId}`),

  /**
   * High-level helper: start a sync and poll to completion.
   * onProgress is called with { completed, total, progressPercentage, successful, failed }.
   * Resolves when isFinished = true.
   */
  syncAllWithProgress: async (
    options?: {
      year?: number;
      onProgress?: (status: {
        completed: number;
        total: number;
        progressPercentage: number;
        successful: number;
        failed: number;
        elapsedTimeMs: number;
      }) => void;
      pollIntervalMs?: number;
      timeoutMs?: number;
    }
  ) => {
    const { year, onProgress, pollIntervalMs = 800, timeoutMs = 120_000 } = options || {};

    // 1. Launch background sync
    const initRes = await request('/api/students/sync-all', {
      method: 'POST',
      body: year ? JSON.stringify({ year }) : undefined,
    });

    const taskId: string = initRes?.data?.taskId;
    if (!taskId) {
      // Legacy path: server completed synchronously (e.g. 0 students)
      return initRes;
    }

    // 2. Poll status until finished or timeout
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs));

      const statusRes = await request(`/api/students/sync-status/${taskId}`);
      const s = statusRes?.data;

      if (onProgress && s) {
        onProgress({
          completed: s.completed ?? 0,
          total: s.total ?? 0,
          progressPercentage: s.progressPercentage ?? 0,
          successful: s.successful ?? 0,
          failed: s.failed ?? 0,
          elapsedTimeMs: s.elapsedTimeMs ?? 0,
        });
      }

      if (s?.isFinished) {
        return statusRes;
      }
    }

    throw new Error('Sync timed out after ' + timeoutMs + 'ms');
  },

  deleteStudent: (id: string | number) =>
    request(`/api/students/${id}`, {
      method: 'DELETE',
    }),
};

export const profileApi = {
  getProfile: (studentId: string | number) => request(`/api/profile/${studentId}`),
  getRankingTrend: (studentId: string | number, days = 30) =>
    request(`/api/profile/${studentId}/ranking-trend?days=${days}`),
};

export const leaderboardApi = {
  getLeaderboard: (params?: any) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/leaderboard${query}`);
  },
};

export const uploadApi = {
  uploadFile: (formData: FormData) =>
    request('/api/upload', {
      method: 'POST',
      body: formData,
    }),
  commitUpload: (data: any) =>
    request('/api/upload/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getHistory: () => request('/api/upload/history'),
  getTemplateUrl: () => '/api/upload/template',
};

export const questionListsApi = {
  getAll: () => request('/api/question-lists'),
  create: (data: any) =>
    request('/api/question-lists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getById: (id: string | number) => request(`/api/question-lists/${id}`),
  evaluate: (id: string | number) =>
    request(`/api/question-lists/${id}/evaluate`, {
      method: 'POST',
    }),
};

export const departmentsApi = {
  getAll: () => request('/api/departments'),
  create: (data: any) =>
    request('/api/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string | number, data: any) =>
    request(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string | number) =>
    request(`/api/departments/${id}`, {
      method: 'DELETE',
    }),
};

export const usersApi = {
  getAll: () => request('/api/users'),
  create: (data: any) =>
    request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string | number, data: any) =>
    request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string | number) =>
    request(`/api/users/${id}`, {
      method: 'DELETE',
    }),
  resetPassword: (id: string | number, password: string) =>
    request(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getStats: () => request('/api/users/stats'),
  getAuditLogs: () => request('/api/users/audit-logs'),
};

export const configApi = {
  getConfig: () => request('/api/config'),
};

export default {
  request,
  authApi,
  reportsApi,
  studentsApi,
  profileApi,
  leaderboardApi,
  uploadApi,
  questionListsApi,
  departmentsApi,
  usersApi,
  configApi,
};
