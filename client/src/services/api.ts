import { RFQ, Part, MaterialRate, MachineRate, LabourRate, CalculationResult, HistoricalQuoteRecord, User } from '../types';

const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('isocode_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errJson = await res.json();
      errorMsg = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch {
      errorMsg = res.statusText;
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ token: string; user: User }>(res);
  },

  async getDemoUsers() {
    const res = await fetch(`${API_BASE}/auth/demo-users`);
    return handleResponse<User[]>(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
    return handleResponse<User>(res);
  },

  // RFQs
  async getRfqs(filters?: { status?: string; search?: string; assignedTo?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);

    const res = await fetch(`${API_BASE}/rfqs?${params.toString()}`, { headers: getHeaders() });
    return handleResponse<RFQ[]>(res);
  },

  async getRfq(id: string) {
    const res = await fetch(`${API_BASE}/rfqs/${id}`, { headers: getHeaders() });
    return handleResponse<RFQ>(res);
  },

  async createRfq(payload: any) {
    const res = await fetch(`${API_BASE}/rfqs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<RFQ>(res);
  },

  async updateRfqStatus(id: string, status: string, lossReason?: string) {
    const res = await fetch(`${API_BASE}/rfqs/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, lossReason }),
    });
    return handleResponse<RFQ>(res);
  },

  // Rates
  async getActiveRates() {
    const res = await fetch(`${API_BASE}/rates/active`, { headers: getHeaders() });
    return handleResponse<{ materials: MaterialRate[]; machines: MachineRate[]; labour: LabourRate[] }>(res);
  },

  async getMaterialRates() {
    const res = await fetch(`${API_BASE}/rates/materials`, { headers: getHeaders() });
    return handleResponse<MaterialRate[]>(res);
  },

  async getMachineRates() {
    const res = await fetch(`${API_BASE}/rates/machines`, { headers: getHeaders() });
    return handleResponse<MachineRate[]>(res);
  },

  async getLabourRates() {
    const res = await fetch(`${API_BASE}/rates/labour`, { headers: getHeaders() });
    return handleResponse<LabourRate[]>(res);
  },

  async createMaterialRate(payload: any) {
    const res = await fetch(`${API_BASE}/rates/materials`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<MaterialRate>(res);
  },

  async createMachineRate(payload: any) {
    const res = await fetch(`${API_BASE}/rates/machines`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<MachineRate>(res);
  },

  // Costing
  async calculateCost(payload: any) {
    const res = await fetch(`${API_BASE}/costing/calculate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<CalculationResult>(res);
  },

  async saveQuote(payload: any) {
    const res = await fetch(`${API_BASE}/costing/save-quote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ quote: any; calculation: CalculationResult; message: string }>(res);
  },

  async getQuote(quoteId: string) {
    const res = await fetch(`${API_BASE}/costing/${quoteId}`, { headers: getHeaders() });
    return handleResponse<any>(res);
  },

  // Approvals
  async getPendingApprovals() {
    const res = await fetch(`${API_BASE}/approvals`, { headers: getHeaders() });
    return handleResponse<any[]>(res);
  },

  async approveQuote(quoteId: string, comments?: string) {
    const res = await fetch(`${API_BASE}/approvals/${quoteId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comments }),
    });
    return handleResponse<{ message: string; quote: any }>(res);
  },

  async rejectQuote(quoteId: string, rejectionReason: string, comments?: string) {
    const res = await fetch(`${API_BASE}/approvals/${quoteId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ rejectionReason, comments }),
    });
    return handleResponse<{ message: string; quote: any }>(res);
  },

  async getApprovalHistory() {
    const res = await fetch(`${API_BASE}/approvals/history`, { headers: getHeaders() });
    return handleResponse<any[]>(res);
  },

  // AI Intake
  async extractAi(rawInput: string, sourceType: 'EMAIL' | 'EXCEL' | 'DRAWING_TITLE_BLOCK', rfqId?: string) {
    const res = await fetch(`${API_BASE}/ai/extract`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ rawInput, sourceType, rfqId }),
    });
    return handleResponse<{ extractionId: string; data: any }>(res);
  },

  // Historical Quotes
  async searchHistoricalQuotes(query?: string, material?: string, customer?: string, page = 1) {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (material) params.append('material', material);
    if (customer) params.append('customer', customer);
    params.append('page', page.toString());

    const res = await fetch(`${API_BASE}/historical/search?${params.toString()}`, { headers: getHeaders() });
    return handleResponse<{ records: HistoricalQuoteRecord[]; pagination: any }>(res);
  },

  async getRoutingSuggestions(partName: string, material?: string) {
    const params = new URLSearchParams({ partName });
    if (material) params.append('material', material);
    const res = await fetch(`${API_BASE}/historical/suggest-routings?${params.toString()}`, { headers: getHeaders() });
    return handleResponse<HistoricalQuoteRecord[]>(res);
  },

  // PDF
  getPdfUrl(quoteId: string) {
    return `${API_BASE}/pdf/quote/${quoteId}`;
  },
};
