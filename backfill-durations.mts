// One-off: set `duration` on existing ready video docs from Cloudinary's probed
// length (the render route used the registry seed, so narrated videos say 10s).
// Dry run unless APPLY=1. Delete this file after running.
const PROJECT = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET!
const TOKEN = process.env.SANITY_API_WRITE_TOKEN!
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME!
const CLD_AUTH = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64')
const APPLY = process.env.APPLY === '1'
const api = `https://${PROJECT}.api.sanity.io/v2025-01-01/data`
const headers = {Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json'}

type Doc = {_id: string; _rev: string; template: string; cloudinaryPublicId: string; duration?: number}

const q = encodeURIComponent(
  `*[_type == "video" && status == "ready" && defined(cloudinaryPublicId)]{_id, _rev, template, cloudinaryPublicId, duration}`,
)
const docs: Doc[] = (await (await fetch(`${api}/query/${DATASET}?query=${q}&perspective=raw`, {headers})).json()).result

const mutations: unknown[] = []
for (const doc of docs) {
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/resources/video/upload/${doc.cloudinaryPublicId}?media_metadata=true`,
    {headers: {Authorization: `Basic ${CLD_AUTH}`}},
  )
  const info = res.ok ? ((await res.json()) as {duration?: number}) : {}
  const actual = typeof info.duration === 'number' ? Math.round(info.duration * 10) / 10 : null
  const changed = actual !== null && actual !== doc.duration
  console.log(`${actual === null ? 'FAIL' : changed ? 'FIX ' : 'OK  '} ${doc._id.padEnd(30)} ${doc.template.padEnd(17)} ${doc.duration}s -> ${actual ?? `? (${res.status})`}s`)
  if (changed) mutations.push({patch: {id: doc._id, ifRevisionID: doc._rev, set: {duration: actual}}})
}

console.log(`\n${mutations.length} doc(s) to patch.`)
if (APPLY && mutations.length) {
  const res = await fetch(`${api}/mutate/${DATASET}?returnIds=true`, {method: 'POST', headers, body: JSON.stringify({mutations})})
  console.log(res.status, JSON.stringify(await res.json()).slice(0, 300))
} else if (!APPLY) {
  console.log('Dry run — re-run with APPLY=1 to write.')
}
