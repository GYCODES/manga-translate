// The base URL for the backend API. 
// When running locally, Vite proxies requests to localhost:3000.
// When deployed on Vercel, this should be set to the Render/Railway backend URL.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
