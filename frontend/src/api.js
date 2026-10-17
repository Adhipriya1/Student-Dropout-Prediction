const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  predict: (payload) =>
    fetch(`${BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),

  modelComparison: () => fetch(`${BASE}/model-comparison`).then(handle),

  coefficientComparison: () => fetch(`${BASE}/coefficient-comparison`).then(handle),

  sampleStudents: () => fetch(`${BASE}/sample-students`).then(handle),

  submitFeedback: (payload) =>
    fetch(`${BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),

  getFeedback: () => fetch(`${BASE}/feedback`).then(handle),

  submitInterventionFeedback: (payload) =>
    fetch(`${BASE}/intervention-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),

  getInterventionFeedback: () => fetch(`${BASE}/intervention-feedback`).then(handle),
};
