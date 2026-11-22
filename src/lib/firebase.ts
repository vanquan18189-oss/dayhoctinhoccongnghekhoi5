export {
  app,
  db,
  auth,
  analytics,
  firebaseConfig,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  resetFirestoreQuotaAndEnableNetwork,
  testFirestoreServerConnectionOnBoot
} from '../firebaseConfig';
export { app as default } from '../firebaseConfig';
