import { File } from 'expo-file-system';

import { API_URL } from './config';
import type { Source } from './picker';
import { supabase } from './supabase';

export type PredictResult = {
  success: boolean;
  predicted_class: string;
  fruit: string | null;
  ripeness: string | null;
  confidence: number;
  uncertain: boolean;
  probabilities: Record<string, number>;
  message: string;
  warnings?: string[];
  timestamp: string;
  saved: boolean;
  scan_id: string | null;
  save_error?: string | null;
};

export class ApiError extends Error {}

const TIMEOUT_MS = 30000;
const log = (...args: unknown[]) => console.log('[FruitCheck]', ...args);

async function request(path: string, init: RequestInit): Promise<Response> {
  if (!API_URL) {
    log('No API URL: app was not loaded from the Expo dev server and EXPO_PUBLIC_API_URL is empty');
    throw new ApiError('The server address is not configured. Set EXPO_PUBLIC_API_URL or start the app with "npx expo start".');
  }
  const url = `${API_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  log(`${init.method} ${url}`);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    log(`${init.method} ${url} -> HTTP ${res.status} in ${Date.now() - started} ms`);
    return res;
  } catch (e) {
    const reason = `${(e as Error).name}: ${(e as Error).message}`;
    log(`${init.method} ${url} failed after ${Date.now() - started} ms:`, reason);
    if ((e as Error).name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.');
    }
    // "Network request failed" is also what React Native reports when a file upload fails,
    // so check whether the server itself is reachable before blaming the connection.
    if (init.method !== 'GET' && (await serverReachable())) {
      throw new ApiError(`The server at ${API_URL} is reachable, but sending the photo failed (${reason}).`);
    }
    throw new ApiError(
      `Cannot reach the server at ${API_URL} (${reason}). Make sure the backend and "npx expo start" are running on the computer.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function serverReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    log(`Reachability check ${API_URL}/health -> HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    log(`Reachability check ${API_URL}/health failed:`, (e as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isPredictResult(b: unknown): b is PredictResult {
  const r = b as PredictResult;
  return (
    !!r &&
    r.success === true &&
    typeof r.predicted_class === 'string' &&
    typeof r.confidence === 'number' &&
    typeof r.uncertain === 'boolean' &&
    typeof r.probabilities === 'object'
  );
}

export async function classifyImage(uri: string, source: Source, imagePath?: string | null): Promise<PredictResult> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;

  // Expo SDK 57 replaces global fetch with expo/fetch, which rejects React Native's
  // { uri, name, type } FormData parts ("Unsupported FormDataPart implementation").
  // expo-file-system's File implements Blob (bytes(), name, type) and is supported.
  // Content-Type and the multipart boundary are set by fetch; do not set them here.
  const photo = new File(uri);
  if (!photo.exists) throw new ApiError('The photo file could not be read. Please take or choose it again.');
  log(`Uploading ${photo.name} (${photo.type || 'unknown type'}, ${photo.size} bytes)`);

  const form = new FormData();
  form.append('file', photo); // field name matches FastAPI's `file: UploadFile`
  form.append('image_source', source);
  if (imagePath) form.append('image_path', imagePath); // private storage key, verified by the backend

  const res = await request('/predict', { method: 'POST', body: form, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    log('Prediction HTTP error', res.status, body?.detail);
    throw new ApiError(body?.detail ?? `The server returned an error (HTTP ${res.status}).`);
  }
  if (!isPredictResult(body)) {
    log('Invalid prediction response', JSON.stringify(body)?.slice(0, 300));
    throw new ApiError('The server sent an unexpected response. Please try again.');
  }
  log(
    `Prediction ${body.predicted_class} (${body.confidence.toFixed(4)}), saved=${body.saved}` +
      (body.saved ? '' : `, reason: ${body.save_error ?? 'not reported (old backend?)'}`),
  );
  return body;
}

export async function checkHealth(): Promise<{ model_loaded: boolean; supabase_configured: boolean }> {
  const res = await request('/health', { method: 'GET' });
  if (!res.ok) throw new ApiError(`Health check failed (HTTP ${res.status}).`);
  return res.json();
}
