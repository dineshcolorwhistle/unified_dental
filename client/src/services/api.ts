import axios from 'axios';
import { getTenantSlug } from '../core/utils/tenantContext';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Subdomain is the primary source of truth for tenant context
  const subdomainSlug = getTenantSlug();
  if (subdomainSlug) {
    config.headers['X-Tenant-Slug'] = subdomainSlug;
  } else {
    // Fallback to localStorage for super admin switching into tenant context
    const storedSlug = localStorage.getItem('active_tenant_slug');
    if (storedSlug) {
      config.headers['X-Tenant-Slug'] = storedSlug;
    }
  }

  const activeBranchId = localStorage.getItem('active_branch_id');
  if (activeBranchId) {
    config.headers['X-Branch-Id'] = activeBranchId;
  }

  const lang = localStorage.getItem('i18nextLng') || 'en';
  config.headers['Accept-Language'] = lang;
  config.headers['X-Custom-Lang'] = lang;

  return config;
});

api.interceptors.response.use(
  (response) => {
    // If backend wrapped in { success: true, data: ... }
    if (response.data && response.data.success !== undefined && response.data.data !== undefined) {
      return {
        ...response,
        data: response.data.data,
        meta: response.data.meta,
      };
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
