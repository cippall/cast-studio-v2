// Augment express-session to include our custom session data
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    accountId: string;
  }
}

// Augment Express Request to carry authenticated account and workspace
declare global {
  namespace Express {
    interface Request {
      account?: import('../middleware/requireSession.js').AccountRow;
      workspace?: import('../middleware/requireSession.js').WorkspaceRow;
    }
  }
}
