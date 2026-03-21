export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'OCO';
  quantity: number;
  price?: number;
  stopPrice?: number;
  limitPrice?: number;
  params?: any;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: string;

  constructor(message: string, status: number, code: string, details: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT = 15_000;
const MAX_RETRIES = 3;
const BASE_DELAY = 500;

async function resilientFetch(url: string, options?: RequestInit & { retries?: number }): Promise<Response> {
  const retries = options?.retries ?? MAX_RETRIES;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Don't retry on client errors (4xx), only server errors (5xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`Server error: ${response.status}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      if (err.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${DEFAULT_TIMEOUT}ms`);
      }
    }

    // Exponential backoff before retry
    if (attempt < retries) {
      const delay = BASE_DELAY * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('Request failed after retries');
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  let message = 'Request failed';
  let details = '';
  let code = 'UNKNOWN_ERROR';

  try {
    const error = await response.json();
    message = error.error || message;
    details = error.details || '';
    code = error.code || 'UNKNOWN_ERROR';
  } catch {
    message = await response.text().catch(() => message);
  }

  return new ApiError(message, response.status, code, details);
}

export const placeOrder = async (order: OrderParams) => {
  const response = await resilientFetch('/api/binance/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  if (!response.ok) throw await parseErrorResponse(response);
  return response.json();
};

export const fetchBalance = async () => {
  const response = await resilientFetch('/api/binance/account');
  if (!response.ok) throw await parseErrorResponse(response);
  return response.json();
};

export const cancelOrder = async (orderId: string, symbol: string) => {
  const response = await resilientFetch('/api/binance/order/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, symbol }),
  });

  if (!response.ok) throw await parseErrorResponse(response);
  return response.json();
};

export const fetchOpenOrders = async (symbol?: string) => {
  const url = symbol ? `/api/backend/openOrders?symbol=${symbol}` : '/api/backend/openOrders';
  const response = await resilientFetch(url);
  if (!response.ok) throw await parseErrorResponse(response);
  return response.json();
};

export const fetchSystemInfo = async () => {
  const response = await resilientFetch('/api/system/info', { retries: 1 });
  if (!response.ok) throw await parseErrorResponse(response);
  return response.json();
};
