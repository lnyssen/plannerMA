import "server-only";

/**
 * Accès à l'API Clockify (REST v1).
 *
 * La clé n'est jamais stockée en base ni saisie dans l'application : elle vit
 * dans `CLOCKIFY_API_KEY`, une variable d'environnement posée par
 * l'administrateur du serveur. Une clé d'API Clockify donne accès à tout
 * l'espace de travail — la mettre dans un champ de formulaire l'exposerait
 * au journal, aux sauvegardes de base et à quiconque a accès à Réglages.
 *
 * `CLOCKIFY_API_BASE` couvre les espaces de travail hébergés sur un domaine
 * régional (euc1, use2, euw2, apse2), qui ne répondent pas sur le domaine
 * global.
 */
const DEFAULT_BASE = "https://api.clockify.me/api/v1";

export interface ClockifyConfig {
  apiKey: string;
  workspaceId: string;
  base: string;
}

/** `null` si l'intégration n'est pas configurée — ce n'est pas une erreur, juste une fonction inactive. */
export function clockifyConfig(): ClockifyConfig | null {
  const apiKey = process.env.CLOCKIFY_API_KEY?.trim();
  const workspaceId = process.env.CLOCKIFY_WORKSPACE_ID?.trim();
  if (!apiKey || !workspaceId) return null;
  return { apiKey, workspaceId, base: process.env.CLOCKIFY_API_BASE?.trim() || DEFAULT_BASE };
}

export class ClockifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "ClockifyError";
  }
}

/**
 * Un appel à l'API, avec une reprise sur 429.
 *
 * Clockify limite le débit (50 requêtes/seconde côté add-on) et répond 429
 * au-delà. Pousser un référentiel entier dépasse largement une requête : sans
 * reprise, l'envoi s'interromprait au milieu et laisserait la moitié des
 * projets sans identifiant.
 */
async function call<T>(
  config: ClockifyConfig,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const response = await fetch(`${config.base}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": config.apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return call<T>(config, path, init, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ClockifyError(`Clockify ${response.status} sur ${path}`, response.status, body.slice(0, 500));
  }

  // 204 sur certaines suppressions — pas de corps à analyser.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ClockifyUser {
  id: string;
  name: string;
  email: string;
}

export interface ClockifyProject {
  id: string;
  name: string;
  clientId?: string | null;
  archived?: boolean;
}

export interface ClockifyClient {
  id: string;
  name: string;
}

export interface ClockifyTimeEntry {
  id: string;
  description: string;
  projectId: string | null;
  userId: string;
  timeInterval: { start: string; end: string | null };
}

export const clockify = {
  /** Sert de test de connexion : valide la clé et l'espace de travail d'un coup. */
  async listUsers(config: ClockifyConfig) {
    return call<ClockifyUser[]>(config, `/workspaces/${config.workspaceId}/users?page-size=200`);
  },

  async listClients(config: ClockifyConfig) {
    return call<ClockifyClient[]>(config, `/workspaces/${config.workspaceId}/clients?page-size=200`);
  },

  async createClient(config: ClockifyConfig, name: string) {
    return call<ClockifyClient>(config, `/workspaces/${config.workspaceId}/clients`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async listProjects(config: ClockifyConfig) {
    return call<ClockifyProject[]>(config, `/workspaces/${config.workspaceId}/projects?page-size=200&archived=false`);
  },

  async createProject(config: ClockifyConfig, input: { name: string; clientId?: string | null }) {
    return call<ClockifyProject>(config, `/workspaces/${config.workspaceId}/projects`, {
      method: "POST",
      body: JSON.stringify({ name: input.name, clientId: input.clientId ?? undefined, isPublic: true }),
    });
  },

  async updateProject(config: ClockifyConfig, projectId: string, input: { name?: string; archived?: boolean }) {
    return call<ClockifyProject>(config, `/workspaces/${config.workspaceId}/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Écritures d'un utilisateur sur une période.
   *
   * `page-size` est plafonné par Clockify : on pagine plutôt que de supposer
   * qu'un mois tient en une réponse.
   */
  async listUserTimeEntries(
    config: ClockifyConfig,
    userId: string,
    range: { start: string; end: string },
    page = 1,
  ) {
    const params = new URLSearchParams({
      start: range.start,
      end: range.end,
      "page-size": "200",
      page: String(page),
      hydrated: "false",
    });
    return call<ClockifyTimeEntry[]>(
      config,
      `/workspaces/${config.workspaceId}/user/${userId}/time-entries?${params}`,
    );
  },
};
