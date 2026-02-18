# TODO: Local Development OAuth Configuration

## Issue
Google OAuth redirects to production URL instead of localhost during local development.

## Root Cause
User has two separate Google OAuth client credentials:
1. **Production keys** - Currently in `.env.local` (work with production domain)
2. **Development keys** - Not yet configured in code

## Solution Needed
1. Add support for separate dev/prod Google OAuth credentials
2. Update `.env.local` to include both sets of keys:
   ```
   # Production OAuth (current - see .env.local for actual values)
   GOOGLE_CLIENT_ID="<prod-client-id>"
   GOOGLE_CLIENT_SECRET="<prod-client-secret>"

   # Development OAuth (to be added)
   GOOGLE_CLIENT_ID_DEV="<dev-client-id>"
   GOOGLE_CLIENT_SECRET_DEV="<dev-client-secret>"
   ```
3. Update `src/lib/auth.ts` to use dev keys when `NODE_ENV=development`
4. Set `NEXTAUTH_URL="http://localhost:3000"` in `.env.local` for dev

## Priority
Low - can test on production for now, fix when doing local development work.

## Related Files
- `src/lib/auth.ts` - OAuth configuration
- `.env.local` - Environment variables
