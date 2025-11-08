export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Get current user from JWT token in cookies (server-side only)
 * This function should only be called in server components or API routes
 */
export async function getCurrentUser() {
  // This will only work on server-side
  if (typeof window !== 'undefined') {
    throw new Error('getCurrentUser() should only be called on server-side');
  }
  
  try {
    const jwt = require("jsonwebtoken");
    const { cookies } = require("next/headers");
    
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    
    if (!token) {
      return null;
    }
    
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded; // { id, username, role }
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}

/**
 * Get current user from API endpoint (client-side)
 */
export async function getCurrentUserClient() {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.success) {
      return data.user; // { id, username, role }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}
