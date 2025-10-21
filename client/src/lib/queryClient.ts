import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Handle session expiration and auto-logout
function handleSessionExpired() {
  console.log('[Auth] Session expired, clearing auth and redirecting to login');
  localStorage.removeItem('b2b_token');
  localStorage.removeItem('b2b_store_hash');
  localStorage.removeItem('b2b_channel_id');
  localStorage.removeItem('b2b_user');
  window.location.href = '/login';
}

// Check if response indicates session expired
function checkSessionExpired(data: any) {
  if (data && (
    data.errMsg === 'Session expired, please login again' ||
    data.message === 'Session expired, please login again' ||
    data.code === 40101 ||
    (data.data && data.data.errMsg === 'Session expired, please login again')
  )) {
    handleSessionExpired();
    return true;
  }
  return false;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('b2b_token');
  const headers: HeadersInit = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Check for session expired in response body
  const clonedRes = res.clone();
  try {
    const responseData = await clonedRes.json();
    checkSessionExpired(responseData);
  } catch (e) {
    // Response might not be JSON, that's OK
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('b2b_token');
    const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {};

    // Extract path (first element) and params (second element if it's an object)
    const path = queryKey[0] as string;
    const params = queryKey[1] as Record<string, any> | undefined;
    
    // Build URL with query parameters
    let url = path;
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${path}?${queryString}`;
      }
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    
    // Check if the response indicates session expired (BigCommerce returns 200 with error)
    checkSessionExpired(data);
    
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
