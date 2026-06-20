// Dashboard.jsx is a route entry point.
// The actual dashboard shell lives in components/Layout.jsx (Outlet).
// Individual dashboard views live under features/dashboard/ and features/onboarding/.
// This file is kept as a named export for future use (e.g. pre-fetching, error boundary).
export { default } from '../features/dashboard/Overview'
