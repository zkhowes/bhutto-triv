// Store authenticated super admin sessions in memory (resets on server restart)
// For production, consider using Redis or database
export const authenticatedSessions = new Set<string>();
