import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  console.error("Firebase configuration is missing required fields:", missingFields.join(', '));
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/** Isolated Auth app so seeding demo users never replaces the signed-in registrar session. */
const SEED_AUTH_APP_NAME = 'campuslink-seed-auth';
export function getSeedAuth(): Auth {
  const existing = getApps().find((a) => a.name === SEED_AUTH_APP_NAME);
  const seedApp = existing ?? initializeApp(firebaseConfig, SEED_AUTH_APP_NAME);
  return getAuth(seedApp);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL: Test connection on boot
export async function testConnection() {
  console.log("Testing Firebase connection...");
  try {
    // Use getDoc instead of getDocFromServer for better resilience
    const testDoc = await getDoc(doc(db, 'system', 'config'));
    console.log("Firebase connection successful:", testDoc.exists() ? "System config found" : "System config not found");
  } catch (error: any) {
    if (error.code === 'permission-denied') {
       console.warn("Firebase connection test: permission-denied (this is expected if not logged in)");
    } else if (error.message?.includes('the client is offline')) {
      console.warn("Firebase connection test: client is currently offline. SDK will reconnect automatically.");
    } else {
      console.error("Database connection test error:", error.message || error);
    }
  }
}

testConnection();
