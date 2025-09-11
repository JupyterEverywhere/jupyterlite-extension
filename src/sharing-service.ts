import { INotebookContent } from '@jupyterlab/nbformat';

/**
 * Token interface from the API
 */
export interface IToken {
  token: string;
}

/**
 * UUID type for notebook IDs
 */
export type UUID = string;

/**
 * Represents the response from sharing a notebook.
 */
export interface IShareResponse {
  message: string;
  notebook: {
    id: UUID;
    readable_id: string;
  };
}

/**
 * Response from retrieving a notebook
 */
export interface INotebookResponse {
  id: UUID;
  domain_id: string;
  readable_id: string;
  content: INotebookContent;
}

/**
 * Validates if a string is a valid UUID
 */
export function validateUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validation helper for objects
 */
export function hasRequiredKeys<T extends object, K extends keyof T>(
  obj: unknown,
  requiredKeys: K[]
): obj is T {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  return requiredKeys.every(key => key in obj);
}

/**
 * Validates token objects
 */
export function validateToken(data: unknown): data is IToken {
  return (
    hasRequiredKeys<IToken, keyof IToken>(data, ['token']) &&
    typeof (data as IToken).token === 'string'
  );
}

/**
 * Validates notebook content
 */
export function validateNotebookContent(data: unknown): data is INotebookContent {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const requiredKeys: (keyof INotebookContent)[] = ['cells', 'metadata', 'nbformat'];
  return requiredKeys.every(key => key in data);
}

/**
 * Validates if the provided data conforms to the IShareResponse interface.
 *
 * Checks for notebook ID
 *
 * @param data - The response to validate.
 * @returns A boolean indicating whether the data conforms to the IShareResponse interface.
 */
function validateShareResponse(data: unknown): data is IShareResponse {
  if (!hasRequiredKeys<IShareResponse, keyof IShareResponse>(data, ['message', 'notebook'])) {
    return false;
  }

  const response = data as IShareResponse;

  if (typeof response.message !== 'string') {
    return false;
  }

  if (
    !hasRequiredKeys<IShareResponse['notebook'], keyof IShareResponse['notebook']>(
      response.notebook,
      ['id', 'readable_id']
    )
  ) {
    return false;
  }

  if (!validateUUID(response.notebook.id)) {
    return false;
  }

  return true;
}

/**
 * Validates if the given data conforms to the INotebookResponse interface.
 *
 * @param data - The data to be validated.
 * @returns A boolean indicating whether the data is a valid INotebookResponse.
 */
function validateNotebookResponse(data: unknown): data is INotebookResponse {
  if (
    !hasRequiredKeys<INotebookResponse, keyof INotebookResponse>(data, [
      'id',
      'domain_id',
      'readable_id',
      'content'
    ])
  ) {
    return false;
  }

  const response = data as INotebookResponse;

  if (!validateUUID(response.id)) {
    return false;
  }

  if (typeof response.domain_id !== 'string') {
    return false;
  }

  if (!validateNotebookContent(response.content)) {
    return false;
  }

  return true;
}

/**
 * Service for interacting with the CKHub Sharing API
 */
export class SharingService {
  /** The base URL of the API (e.g. localhost:8080/api/v1/). */
  private readonly api_url: URL;

  /** The current authentication token. */
  private _token?: IToken;

  /**
   * Retrieves the current authentication token, authenticating if necessary.
   * Our strategy is as follows:
   * 1. If we have an in-memory token, return it.
   * 2. Otherwise, we try a cookie-based refresh first to resume a prior session.
   * 3. If that fails (no/expired cookie), we issue a fresh token/session.
   *
   * @returns A promise that resolves to the current authentication token.
   */
  get token(): Promise<IToken> {
    return (async () => {
      if (this._token) {
        return this._token;
      }
      try {
        // Attempt to resume the existing session using the HttpOnly cookie
        this._token = await this.refresh();
        return this._token;
      } catch {
        // No valid cookie/session; issue a new one
        this._token = await this.authenticate();
        return this._token;
      }
    })();
  }

  /**
   * Creates an instance of the SharingService.
   *
   * @param url - The base URL of the API (e.g. localhost:8080/api/v1/).
   */
  constructor(url: string | URL) {
    this.api_url = url instanceof URL ? url : new URL(url);
    if (!this.api_url.pathname.endsWith('/')) {
      this.api_url.pathname += '/';
    }
  }

  /**
   * Authenticates the user by making a POST request to the authentication endpoint.
   *
   * @returns {Promise<IToken>} A promise that resolves to an authentication token.
   * @throws {Error} If the authentication request fails or the token response is invalid.
   */
  async authenticate(): Promise<IToken> {
    const endpoint = new URL('auth/issue', this.api_url);

    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: await this.makeHeaders()
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const responseData = await response.json();

    if (!validateToken(responseData)) {
      throw new Error('Invalid token response');
    }

    this._token = responseData;
    return responseData;
  }

  /**
   * Refreshes the current token using the cookie set by the server.
   *
   * @returns A promise that resolves to the refreshed token.
   * @throws {Error} If the refresh request fails or the token response is invalid.
   */
  async refresh(): Promise<IToken> {
    const endpoint = new URL('auth/refresh', this.api_url);

    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: await this.makeHeaders()
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const refreshed = await response.json();

    if (!validateToken(refreshed)) {
      throw new Error('Invalid token response from refresh');
    }

    this._token = refreshed;
    return refreshed;
  }

  /**
   * Perform a "log out"-like action by asking the server to clear the
   * HttpOnly cookie, and then drop our in-memory token.
   */
  async logout(): Promise<void> {
    const endpoint = new URL('auth/logout', this.api_url);
    try {
      await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: await this.makeHeaders()
      });
    } finally {
      this._token = undefined;
    }
  }

  /**
   * Retrieves a notebook by its ID.
   *
   * @param id - The ID of the notebook to retrieve.
   * @returns A promise that resolves to the notebook response.
   * @throws {Error} If the notebook retrieval fails or if the response is invalid.
   */
  async retrieve(id: string): Promise<INotebookResponse> {
    id = id.trim();
    const endpoint = validateUUID(id)
      ? new URL(`notebooks/${id}`, this.api_url)
      : new URL(`notebooks/get-by-readable-id/${id}`, this.api_url);

    const token = await this.token;
    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: await this.makeHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve notebook: ${response.statusText}`);
    }

    const responseData = await response.json();

    if (!validateNotebookResponse(responseData)) {
      throw new Error('Invalid notebook response from API');
    }

    return responseData;
  }

  /**
   * Stores a notebook on the server and returns a share response with the notebook ID and metadata.
   *
   * @param notebook - The notebook content to be shared.
   * @returns A promise that resolves to the share response.
   * @throws {Error} If the notebook content is invalid or if the sharing request fails.
   */
  async share(notebook: INotebookContent): Promise<IShareResponse> {
    if (!validateNotebookContent(notebook)) {
      throw new Error('Invalid notebook content');
    }

    const requestData: Record<string, any> = { notebook };

    const endpoint = new URL('notebooks', this.api_url);

    const token = await this.token;
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: await this.makeHeaders(token),
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Sharing notebook failed: ${response.statusText}`);
    }

    const responseData = await response.json();

    if (!validateShareResponse(responseData)) {
      throw new Error('Unexpected API response while sharing');
    }

    return responseData;
  }

  /**
   * Updates an existing shared notebook
   * @param id - Notebook ID
   * @param notebook - Updated notebook content
   * @returns API response with updated notebook details
   */
  async update(id: string, notebook: INotebookContent): Promise<IShareResponse> {
    if (!validateNotebookContent(notebook)) {
      throw new Error('Invalid notebook content');
    }

    const requestData: Record<string, any> = notebook;

    const endpoint = new URL(`notebooks/${id}`, this.api_url);

    const token = await this.token;
    const response = await fetch(endpoint, {
      method: 'PUT',
      credentials: 'include',
      headers: await this.makeHeaders(token),
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Updating notebook failed: ${response.statusText}`);
    }

    const responseData = await response.json();

    if (!validateShareResponse(responseData)) {
      throw new Error('Unexpected API response while updating');
    }

    return responseData;
  }

  /**
   * Constructs a URL for retrieving a notebook by its unique identifier.
   *
   * @param id - The unique identifier (UUID) or readable ID of the notebook.
   * @returns The constructed URL for retrieving the notebook.
   */
  makeRetrieveURL(id: UUID | string): URL {
    if (!id) {
      throw new Error('Notebook ID is required');
    }

    const url = validateUUID(id)
      ? new URL(`notebooks/${id}`, this.api_url)
      : new URL(`notebooks/get-by-readable-id/${id}`, this.api_url);

    return url;
  }

  /**
   * Constructs headers for HTTP requests.
   *
   * @param token - The authentication token to include in the headers.
   * @param extra - Additional headers to include.
   * @returns A promise that resolves to the constructed headers.
   */
  private async makeHeaders(token?: IToken, extra?: HeadersInit): Promise<Headers> {
    const headers = new Headers({ 'Content-Type': 'application/json' });

    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        headers.set(key, value.toString());
      });
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token.token}`);
    }

    return headers;
  }
}
