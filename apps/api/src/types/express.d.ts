declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: "user" | "admin";
    }
  }
}

export {};
