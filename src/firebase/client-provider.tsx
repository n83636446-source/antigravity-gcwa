'use client';

import React, { useMemo, type ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    if (firebaseServices.auth) {
      const unsubscribe = onAuthStateChanged(firebaseServices.auth, (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setIsLoading(false);
        } else {
          // If no user is logged in, sign in anonymously.
          signInAnonymously(firebaseServices.auth).catch((error) => {
            console.error("Anonymous sign-in failed: ", error);
            setIsLoading(false);
          });
        }
      });
      return () => unsubscribe();
    }
  }, [firebaseServices.auth]);

  // We wait until the authentication status is resolved before rendering the children
  // to prevent permission errors on initial load.
  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
