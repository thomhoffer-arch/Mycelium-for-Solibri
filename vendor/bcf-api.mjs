// Canonical BCF-API → Connective Spine mapping.
//
// HOUSE RULE: this file is the single source of truth for the BCF topic→spine
// mapping. It is **vendored** (copied identically) into each connector that
// speaks BCF — Mycelium-for-Dalux, Mycelium-for-Solibri, Mycelium-for-BIMcollab
// — exactly like `vendor/mycelium-sdk.mjs`. Edit it HERE, then re-sync the
// copies. One canonical source, duplicated artifact, one-package-per-tool install.
//
// Deliberately **import-free and zero-dep** so the copy is portable to any
// connector directory without rewriting paths. Helpers it needs (deriveIfcGuid)
// are passed IN from the connector's vendored SDK.

// Transport presets for true BCF-API REST servers. Solibri issues arrive via
// its local /bcfxml endpoint instead, so Solibri reuses topicToRow() directly.
export const BCF_PRESETS = {
  dalux: {
    source: 'dalux',
    baseUrl: 'https://field.dalux.com/service/api/bcf/2.1',
    auth: 'oauth2-bearer',
  },
  bimcollab: {
    source: 'bimcollab',
    baseUrl: 'https://{space}.bimcollab.com/bcf/2.1',
    auth: 'oauth2-bearer',
  },
};

// First component IFC GlobalId from a topic's viewpoints, if present.
export function firstComponentIfcGuid(topic) {
  for (const vp of topic.viewpoints ?? []) {
    const sel = vp?.components?.selection ?? [];
    for (const c of sel) if (c?.ifc_guid) return c.ifc_guid;
  }
  return undefined;
}

// Pure mapping: one BCF topic → one spine-adapter row. `deriveIfcGuid` is the
// vendored SDK helper; pass it so this file stays import-free.
export function topicToRow(topic, { projectKey, deriveIfcGuid } = {}) {
  let ifcGuid = topic.ifc_guid ?? firstComponentIfcGuid(topic);
  if (!ifcGuid && topic.revit_unique_id && typeof deriveIfcGuid === 'function') {
    try { ifcGuid = deriveIfcGuid(topic.revit_unique_id); } catch { /* leave undefined */ }
  }
  return {
    localId: topic.guid,
    project: projectKey ?? topic.project,
    ifcGuid,
    zone: topic.zone, // present only on BIMcollab-extended servers
    modified: topic.modified_date ?? topic.creation_date,
    text: topic.title ?? '',
  };
}

async function getJson(url, token, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`BCF-API ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Build a fetchSource() that pulls topics (+ their viewpoints) from a real
// BCF-API REST server and returns spine rows. Used by Dalux/BIMcollab; Solibri
// has its own client. Caller supplies token/projectId/deriveIfcGuid.
export function makeBcfApiFetch({
  baseUrl,
  token,
  projectId,
  projectKey,
  deriveIfcGuid,
  fetchImpl = fetch,
} = {}) {
  return async function fetchSource() {
    const topics = await getJson(`${baseUrl}/projects/${projectId}/topics`, token, fetchImpl);
    const rows = [];
    for (const t of topics ?? []) {
      const vps = await getJson(
        `${baseUrl}/projects/${projectId}/topics/${t.guid}/viewpoints`, token, fetchImpl,
      ).catch(() => []);
      rows.push(topicToRow({ ...t, viewpoints: vps }, { projectKey, deriveIfcGuid }));
    }
    return rows;
  };
}
