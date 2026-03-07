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

export const placeOrder = async (order: OrderParams) => {
  const response = await fetch('/api/binance/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to place order';
    let details = '';
    let code = 'UNKNOWN_ERROR';
    
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
      details = error.details || '';
      code = error.code || 'UNKNOWN_ERROR';
    } catch (e) {
      errorMessage = await response.text();
    }

    const err = new Error(errorMessage);
    (err as any).details = details;
    (err as any).code = code;
    throw err;
  }

  return response.json();
};

export const fetchBalance = async () => {
  const response = await fetch('/api/binance/account');
  if (!response.ok) {
    let errorMessage = 'Failed to fetch balance';
    let details = '';
    let code = 'UNKNOWN_ERROR';
    
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
      details = error.details || '';
      code = error.code || 'UNKNOWN_ERROR';
    } catch (e) {
      errorMessage = await response.text();
    }

    const err = new Error(errorMessage);
    (err as any).details = details;
    (err as any).code = code;
    throw err;
  }
  return response.json();
};
