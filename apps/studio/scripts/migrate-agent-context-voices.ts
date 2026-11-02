import {getCliClient} from 'sanity/cli'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

type LegacyVoice = {
  _id: string
  _type: string
  name?: string
  slug?: {_type: 'slug'; current?: string}
  instructions?: string
  [key: string]: unknown
}

type Referrer = {_id: string; voice?: {_ref?: string}}

const apply = process.argv.includes('--apply')
const client = getCliClient({apiVersion: '2025-02-19'}).withConfig({perspective: 'raw'})

function withoutSystemFields({_rev, _createdAt, _updatedAt, ...doc}: LegacyVoice) {
  return doc
}

async function main() {
  const voices = await client.fetch<LegacyVoice[]>(`*[_type == "sanity.agentContext"]`)
  if (voices.length === 0) {
    console.log('No sanity.agentContext documents found. Nothing to migrate.')
    return
  }

  const ids = voices.map((v) => v._id)
  const referrers = await client.fetch<Referrer[]>(`*[references($ids)]{_id, voice}`, {ids})

  const unexpected = referrers.filter((r) => !r.voice?._ref || !ids.includes(r.voice._ref))
  if (unexpected.length > 0) {
    throw new Error(
      `These documents reference a voice outside the \`voice\` field; migrate them by hand first: ${unexpected
        .map((r) => r._id)
        .join(', ')}`,
    )
  }

  console.log(`Voices to convert (${voices.length}):`)
  for (const v of voices) console.log(`  ${v._id}  "${v.name ?? ''}"`)
  console.log(`Documents whose \`voice\` reference is re-pointed (${referrers.length}):`)
  for (const r of referrers) console.log(`  ${r._id} → ${r.voice!._ref}`)

  if (!apply) {
    console.log('\nDry run. Re-run with `-- --apply` to commit.')
    return
  }

  const backupPath = join(tmpdir(), `agent-context-voices-${Date.now()}.json`)
  writeFileSync(backupPath, JSON.stringify({voices, referrers}, null, 2))
  console.log(`\nBackup written to ${backupPath}`)

  const restoreRefs = (tx: ReturnType<typeof client.transaction>) => {
    for (const r of referrers) {
      tx.patch(r._id, (p) => p.set({voice: {_type: 'reference', _ref: r.voice!._ref}}))
    }
    return tx
  }

  const remove = client.transaction()
  for (const r of referrers) remove.patch(r._id, (p) => p.unset(['voice']))
  for (const v of voices) remove.delete(v._id)
  await remove.commit()
  console.log('Removed legacy voices.')

  const recreate = client.transaction()
  for (const v of voices) {
    recreate.create({
      _id: v._id,
      _type: 'brandVoice',
      name: v.name?.trim() || v._id,
      slug: v.slug?.current ? {_type: 'slug', current: v.slug.current} : undefined,
      instructions: v.instructions ?? '',
    })
  }
  try {
    await restoreRefs(recreate).commit()
  } catch (err) {
    console.error('Creating brandVoice documents failed; restoring the originals.')
    const rollback = client.transaction()
    for (const v of voices) rollback.createOrReplace(withoutSystemFields(v))
    await restoreRefs(rollback).commit()
    throw err
  }

  console.log('Created brandVoice documents and restored `voice` references.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
