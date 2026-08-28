/**
 * Navigation helpers to manage Admin route states.
 * Centralizes routing to prevent desync between hash and pathname.
 */

export const normalizeAdminRoute = () => {
  if (typeof window === 'undefined') return;
  // If the user manually loaded /admin, redirect to /#admin to avoid 404s on refresh for static hosts
  if (window.location.pathname.startsWith('/admin')) {
    window.history.replaceState(null, '', '/#admin');
  }
};

export const isAdminRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin') || window.location.hash.includes('admin');
};

export const navigateToAdmin = () => {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.includes('admin')) {
    window.location.hash = 'admin';
  }
};

export const navigateToPOS = () => {
  if (typeof window === 'undefined') return;
  
  let updated = false;
  
  if (window.location.hash.includes('admin')) {
    window.location.hash = '';
    updated = true;
  }
  
  if (window.location.pathname.startsWith('/admin')) {
    window.history.pushState(null, '', '/');
    updated = true;
  }

  // Clean up trailing '#' if hash was just emptied
  if (window.location.href.endsWith('#')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    updated = true;
  }
  
  // Hash assignment triggers hashchange, but pushState/replaceState do not trigger popstate.
  // Manually trigger popstate so our listeners always catch the change.
  if (updated) {
    window.dispatchEvent(new Event('popstate'));
  }
};

export const subscribeToRouteChanges = (callback: (isAdmin: boolean) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleLocationChange = () => {
    callback(isAdminRoute());
  };

  window.addEventListener('popstate', handleLocationChange);
  window.addEventListener('hashchange', handleLocationChange);

  return () => {
    window.removeEventListener('popstate', handleLocationChange);
    window.removeEventListener('hashchange', handleLocationChange);
  };
};
