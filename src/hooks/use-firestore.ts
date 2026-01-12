// THIS FILE IS NO LONGER IN USE AND WILL BE REMOVED IN A FUTURE UPDATE.
// The `useFirestore` hook has been moved to `@/firebase` to consolidate all Firebase-related logic.

import { useContext } from 'react';
import { FirebaseContext, FirebaseContextState } from '@/firebase/provider';
import { Firestore } from 'firebase/firestore';

/**
 * @deprecated This hook is deprecated. Please import and use `useFirestore` from `'@/firebase'` instead.
 * 
 * Hook to access the Firestore instance.
 * @returns {Firestore} The Firestore service instance.
 * @throws If used outside of a FirebaseProvider or if Firestore is not available.
 */
export const useFirestore = (): Firestore => {
  const context = useContext<FirebaseContextState | undefined>(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirebaseProvider.');
  }

  if (!context.firestore) {
    throw new Error('Firestore is not available. Ensure it is provided in FirebaseProvider.');
  }

  return context.firestore;
};

    