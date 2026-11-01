// Imported first by server/index.ts so it is evaluated before Next.js (or anything else) can add
// runtime variables: snapshot the environment that managed commands will inherit.
import { captureBaseEnv } from "../lib/process-manager/child-env";

captureBaseEnv();
