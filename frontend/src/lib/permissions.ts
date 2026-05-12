/**
 * RBAC Permission Helpers
 * 
 * These functions determine what users can see and do based on their role.
 */

export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Check if user can access admin features
 * 
 * Admin features include:
 * - Settings menu
 * - User management
 * - Role management
 * - Organization settings
 * - Email configuration
 * - System settings
 * 
 * Only admin and super_admin roles can access these features.
 */
export function canAccessAdmin(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }

  // Check role field (primary method)
  if (user.role) {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return true;
    }
  }

  // Check roles array (if backend returns array)
  if (user.roles && Array.isArray(user.roles)) {
    if (user.roles.includes('admin') || user.roles.includes('super_admin')) {
      return true;
    }
  }

  // Check permissions array (if backend returns permissions)
  if (user.permissions && Array.isArray(user.permissions)) {
    const adminPermissions = [
      'settings.manage',
      'users.manage',
      'roles.manage',
      'system.manage'
    ];
    
    if (adminPermissions.some(perm => user.permissions?.includes(perm))) {
      return true;
    }
  }

  // Fallback: check is_superuser for backward compatibility
  if (user.is_superuser === true) {
    return true;
  }

  return false;
}

/**
 * Check if user can manage users
 */
export function canManageUsers(user: User | null | undefined): boolean {
  return canAccessAdmin(user);
}

/**
 * Check if user can manage roles
 */
export function canManageRoles(user: User | null | undefined): boolean {
  return canAccessAdmin(user);
}

/**
 * Check if user can manage system settings
 */
export function canManageSettings(user: User | null | undefined): boolean {
  return canAccessAdmin(user);
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role: string | undefined): string {
  if (!role) return 'Người dùng';
  
  const roleNames: Record<string, string> = {
    'super_admin': 'Quản trị viên cấp cao',
    'admin': 'Quản trị viên',
    'manager': 'Quản lý',
    'analyst': 'Phân tích viên',
    'communication': 'Truyền thông',
    'legal': 'Pháp lý',
    'customer_care': 'Chăm sóc khách hàng',
    'viewer': 'Người xem'
  };
  
  return roleNames[role] || role;
}

/**
 * Get user role badge color
 */
export function getRoleBadgeColor(role: string | undefined): string {
  if (!role) return 'bg-gray-100 text-gray-800';
  
  const colors: Record<string, string> = {
    'super_admin': 'bg-purple-100 text-purple-800',
    'admin': 'bg-red-100 text-red-800',
    'manager': 'bg-blue-100 text-blue-800',
    'analyst': 'bg-green-100 text-green-800',
    'communication': 'bg-yellow-100 text-yellow-800',
    'legal': 'bg-indigo-100 text-indigo-800',
    'customer_care': 'bg-pink-100 text-pink-800',
    'viewer': 'bg-gray-100 text-gray-800'
  };
  
  return colors[role] || 'bg-gray-100 text-gray-800';
}
