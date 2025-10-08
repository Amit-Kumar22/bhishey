"use client";
import { useEffect } from 'react';
import { useAppSelector } from '@/hooks/useStore';
import { RootState } from '@/store';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Redirects unauthenticated users away from protected admin routes.
 * IMPORTANT: Waits for rehydration to complete before checking auth.
 */
export function useAuthGuard() {
  const { user, status, rehydrated } = useAppSelector((s: RootState) => s.auth);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // CRITICAL: Wait for rehydration to complete before checking auth
    // This prevents redirecting users who have valid tokens but haven't been rehydrated yet
    if (!rehydrated) {
      console.log('⏳ Auth guard waiting for rehydration...');
      return;
    }

    // Avoid redirect while auth still loading
    if (status === 'loading') {
      console.log('⏳ Auth guard waiting for auth status...');
      return;
    }

    // Now we can safely check if user is authenticated
    if (!user) {
      // Preserve return path, but don't redirect if already on login page
      if (pathname === '/admin/login') return;
      console.log('🔒 No user found after rehydration, redirecting to login');
      const ret = encodeURIComponent(pathname || '/admin');
      router.replace(`/admin/login?next=${ret}`);
    } else {
      console.log('✅ User authenticated:', user.email);
    }
  }, [user, status, rehydrated, router, pathname]);

  return { user, status, rehydrated, isAuthenticated: !!user };
}

export function withAuthGuard<P extends object>(Component: React.ComponentType<P>) {
  return function Guarded(props: P) {
    const { isAuthenticated, status, rehydrated } = useAuthGuard();
    
    // Show loading while rehydrating or authenticating
    if (!rehydrated || status === 'loading') {
      return (
        <div className="p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-accent-500 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-500">
            {!rehydrated ? 'Loading session...' : 'Checking authentication...'}
          </p>
        </div>
      );
    }
    
    // After rehydration, if not authenticated, show nothing (redirect will happen)
    if (!isAuthenticated) {
      return null;
    }
    
    return <Component {...props} />;
  };
}
