
# Verify Google OAuth on the published site

Your Google SSO code is already correctly wired:
- `auth.tsx` calls `lovable.auth.signInWithOAuth("google", { redirect_uri: ${origin}/dashboard })`
- The Lovable managed Google OAuth requires **no secret setup**
- On success, the user lands on `/dashboard`, which is protected by `useAuth` and shows the dashboard once the session is set

The `missing OAuth secret` 400 error you saw is almost always an environment-specific backend config issue in the **preview environment** — not your application code. Per Lovable's known guidance, OAuth in the preview Cloud Dev environment can fail even when production works perfectly.

## Recommended verification path

1. **Publish the project** (Publish button, top-right of Lovable).
2. Open the **published URL** (`https://...lovable.app`).
3. Click **Continue with Google** on `/auth`.
4. Confirm you land on `/dashboard` and see your greeting.

## Expected outcomes

- **Works on published site** → the code and managed Google OAuth are fully functional. Preview-only failures are an environment issue and require no code changes. You can keep developing in preview and use the published URL whenever you need to test the Google flow end-to-end.
- **Fails on published site too** → then there's a real config problem and we'll dig into the Cloud Auth Settings together (open the Lovable Cloud dashboard → Users → Auth Settings → Google).

## What I will NOT change

Per Lovable's stack guidance, I will not:
- Modify the OAuth `redirect_uri` or callback URL
- Switch from `lovable.auth.signInWithOAuth` to a direct Supabase client call (managed OAuth requires the lovable wrapper)
- Add CORS headers or alter fetch behavior
- Reconfigure the providers table or RLS

These would all break the working managed-OAuth flow.

## If you want a code-level change anyway

The only reasonable code change would be to **also pass `prompt: "select_account"`** to the Google call, so users with multiple Google accounts always see the picker instead of being silently signed in with the most recent one. This is a UX nicety, not a fix. Let me know if you'd like that added.

## Action for you

Click **Publish** and test the Google button on the published URL. Reply with the result and — if it still fails there — paste the exact error message and I'll investigate the live auth logs.
