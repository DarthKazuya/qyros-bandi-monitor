# Supabase Auth email templates

Tracked copies of the two Auth email templates this project customizes.
Hosted Supabase projects have no CLI/API deploy path reachable without a
personal access token, so these are pasted in manually — this directory is
the source of truth to copy from, the Dashboard is where they actually run.

## Publishing a change

1. Go to `supabase.com/dashboard/project/atcdtnmwbllvdeikswfk/auth/templates`.
2. Pick the template ("Magic Link" or "Invite user").
3. Replace its content with the matching file here.
4. Save.

## Why both show a 6-digit code

Supabase generates a `{{ .Token }}` (code) tied to the same one-time pass as
`{{ .ConfirmationURL }}` (link) for every auth email. Showing both lets a
user complete login by typing the code even if the link gets silently
consumed first — e.g. by a mail provider's automated link-prefetching /
safe-link scanning, which Supabase's own docs list as a known cause of
"Token has expired or is invalid" on a link the user never actually clicked.
