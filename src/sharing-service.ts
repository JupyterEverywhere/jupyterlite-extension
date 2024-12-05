import { INotebookContent } from '@jupyterlab/nbformat';

import { validateNotebookContent } from './notebook';
import { IToken, validateToken } from './token';
import { UUID, validateUUID } from './uuid';
import { hasRequiredKeys } from './validator';

/** Service for sharing and retrieving Jupyter notebooks. */
export class SharingService {
  /** The base URL of the API (e.g. localhost:8080/api/v1/). */
  private readonly api_url: URL;

  /** The current authentication token. */
  private _token?: IToken;

  /**
   * Retrieves the current authentication token, authenticating if necessary.
   *
   * @returns A promise that resolves to the current authentication token.
   */
  get token(): Promise<IToken> {
    return (async () => this._token ?? (await this.authenticate()))();
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
      headers: await this.makeHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate: ${response.statusText}`);
    }

    const responseData = await response.json();
    if (!validateToken(responseData)) {
      throw new Error('Invalid token response');
    }

    this._token = responseData;
    return responseData;
  }

  /**
   * Refreshes the current token.
   *
   * @param token - The token to be refreshed. If not provided, the current token will be used.
   * @returns A promise that resolves to the refreshed token.
   * @throws {Error} If the authentication request fails or the token response is invalid.
   */
  async refresh(token?: IToken): Promise<IToken> {
    token = await this.token;
    if (!token) {
      throw new Error('No token to refresh');
    }

    const endpoint = new URL('auth/refresh', this.api_url);
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const refreshed = await response.json();
    if (!validateToken(refreshed)) {
      throw new Error('Invalid token response');
    }

    this._token = refreshed;
    return refreshed;
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

    const response = await fetch(endpoint, {
      headers: await this.makeHeaders(await this.token)
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve notebook: ${response.statusText}`);
    }

    const responseData = await response.json();
    if (!validateNotebookResponse(responseData)) {
      throw new Error('Invalid notebook response');
    }

    return responseData;
  }

  /**
   * Stores a notebook on the server and returns a share response with the notebook ID and metadata.
   *
   * @param notebook - The notebook content to be shared.
   * @param password - An optional password to allow editing the shared notebook later.
   * @returns A promise that resolves to the share response.
   * @throws {Error} If the notebook content is invalid or if the sharing request fails.
   */
  async share(notebook: INotebookContent, password?: string): Promise<IShareResponse> {
    if (!validateNotebookContent(notebook)) {
      throw new Error('Invalid notebook given.');
    }

    const requestData = { notebook, password };
    if (!requestData.password) {
      delete requestData.password;
    }

    const endpoint = new URL('notebooks', this.api_url);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await this.makeHeaders(await this.token),
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Failed to share data: ${response.statusText}`);
    }

    const responseData = await response.json();
    if (!validateShareResponse(responseData)) {
      throw new Error(`Unexpected share response: ${JSON.stringify(responseData)}`);
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
    return validateUUID(id)
      ? new URL(`notebooks/${id}`, this.api_url)
      : new URL(`notebooks/get-by-readable-id/${id}`, this.api_url);
  }

  /**
   * Constructs headers for HTTP requests.
   *
   * @param token - The authentication token to include in the headers.
   * @param extra - Additional headers to include.
   * @returns A promise that resolves to the constructed headers.
   */
  private async makeHeaders(token?: IToken, extra?: HeadersInit): Promise<Headers> {
    extra = extra ?? {};
    const headers = new Headers({ 'Content-Type': 'application/json', ...extra });

    if (token) {
      headers.set('Authorization', `Bearer ${token.token}`);
    }

    return headers;
  }
}

/**
 * Represents the response from sharing a notebook.
 */
interface IShareResponse {
  message: string;
  notebook: {
    id: UUID;
    readable_id: string;
  };
}

/**
 * Validates if the provided data conforms to the IShareResponse interface.
 *
 * @param data - The data to validate.
 * @returns A boolean indicating whether the data conforms to the IShareResponse interface.
 */
function validateShareResponse(data: unknown): data is IShareResponse {
  return (
    hasRequiredKeys<IShareResponse, keyof IShareResponse>(data, ['message', 'notebook']) &&
    typeof data.message === 'string' &&
    hasRequiredKeys<IShareResponse['notebook'], keyof IShareResponse['notebook']>(
      data['notebook'],
      ['id', 'readable_id']
    ) &&
    validateUUID(data.notebook.id)
    // TODO: bug where readable_id is null
    // && data.notebook.readable_id === 'string'
  );
}

/**
 * Represents the response from retrieving a notebook.
 */
interface INotebookResponse {
  id: UUID;
  domain_id: string;
  readable_id: string;
  content: INotebookContent;
}

/**
 * Validates if the given data conforms to the INotebookResponse interface.
 *
 * @param data - The data to be validated.
 * @returns A boolean indicating whether the data is a valid INotebookResponse.
 */
function validateNotebookResponse(data: unknown): data is INotebookResponse {
  return (
    hasRequiredKeys<INotebookResponse, keyof INotebookResponse>(data, [
      'id',
      'domain_id',
      'readable_id',
      'content'
    ]) &&
    validateUUID(data.id) &&
    typeof (data as INotebookResponse).domain_id === 'string' &&
    typeof (data as INotebookResponse).readable_id === 'string' &&
    validateNotebookContent(data.content)
  );
}
