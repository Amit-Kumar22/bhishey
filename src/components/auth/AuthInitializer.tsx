"use client";
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/useStore';
import { rehydrate } from '@/store/slices/authSlice';

export default function AuthInitializer() {
  const dispatch = useAppDispatch();
  const { rehydrated, user } = useAppSelector(s => s.auth);
  
  useEffect(() => {
    if (!rehydrated) {
      console.log('🔄 AuthInitializer: Starting rehydration...');
      // Silently attempt to restore auth state
      // Errors are handled gracefully in the redux slice
      dispatch(rehydrate());
    } else {
      console.log('✅ AuthInitializer: Rehydration complete', user ? `User: ${user.email}` : 'No user');
    }
  }, [rehydrated, dispatch, user]);
  
  return null; // This is a silent background component with no UI
}
