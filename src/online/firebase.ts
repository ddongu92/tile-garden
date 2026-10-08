import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** .env 설정이 되어 있어야 온라인 기능을 쓸 수 있다. */
export const firebaseReady = !!(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function init() {
  if (!firebaseReady) throw new Error('Firebase 설정(.env)이 없습니다.');
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

export function getDb(): Firestore {
  init();
  return db!;
}

let userPromise: Promise<User> | null = null;

/** 익명 로그인. uid는 브라우저에 저장되어 같은 기기에서는 계속 유지된다. */
export function ensureUser(): Promise<User> {
  init();
  if (!userPromise) {
    userPromise = new Promise<User>((resolve, reject) => {
      const unsub = onAuthStateChanged(
        auth!,
        (u) => {
          if (u) {
            unsub();
            resolve(u);
          } else {
            signInAnonymously(auth!).catch((e) => {
              unsub();
              userPromise = null;
              reject(e);
            });
          }
        },
        (e) => {
          userPromise = null;
          reject(e);
        },
      );
    });
  }
  return userPromise;
}
