import { createClient } from 'npm:@supabase/supabase-js@2'

const PAGE = 1000
const DATE = /^\d{4}-\d{2}-\d{2}$/

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-api-key',
  'Cache-Control': 'no-store',
}

type Row = Record<string, any>

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: HEADERS })

async function all(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>) {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) return rows
  }
}

const round = (value: number) => Math.round(value * 100) / 100

const repsOf = (type: string) => (type === 'rir' || type === 'failure' ? 'amrap' : type)

function effortOf(set: Row): string | null {
  if (set.type === 'rir') return 'rir'
  if (set.type === 'failure') return 'failure'
  if (set.target_effort) return set.target_effort
  return set.target_rpe != null ? 'rpe' : null
}

function targetOf(set: Row) {
  const type = repsOf(set.type)
  const effort = effortOf(set)
  const target: Row = { type }

  if (type === 'fixed') target.reps = set.target_reps
  if (type === 'range') Object.assign(target, { reps_min: set.target_reps_min, reps_max: set.target_reps_max })
  if (effort) target.effort = effort
  if (effort === 'rir') Object.assign(target, { rir_min: set.target_rir_min ?? 0, rir_max: set.target_rir_max ?? set.target_rir_min ?? 0 })
  if (effort === 'rpe') target.rpe = set.target_rpe != null ? Number(set.target_rpe) : null

  return target
}

function setOf(set: Row, bodyweightExercise: boolean, timedExercise: boolean) {
  const weight = set.weight != null ? Number(set.weight) : null
  const bodyweightKg = set.bodyweight_kg != null ? Number(set.bodyweight_kg) : null
  const out: Row = { set: set.set_index, weight_kg: weight }

  if (bodyweightExercise && bodyweightKg != null) {
    out.bodyweight_kg = bodyweightKg
    out.added_load_kg = round((weight ?? 0) - bodyweightKg)
  }

  return {
    ...out,
    ...(timedExercise ? { seconds: set.reps } : { reps: set.reps }),
    done: set.done,
    done_at: set.done_at,
    target: targetOf(set),
    technique: set.technique || null,
    gear: set.gear ?? [],
  }
}

function workoutName(session: Row, routines: Map<string, string>) {
  if (!session.routine_id) return session.name?.trim() || 'Entreno extra'
  const name = routines.get(session.routine_id) ?? 'Entreno'
  return session.freestyle ? `${name} (a mi aire)` : name
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: HEADERS })
  if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' })

  const params = new URL(request.url).searchParams
  const token = request.headers.get('x-api-key') ?? ''
  const from = params.get('from')
  const to = params.get('to')
  const limit = params.get('limit') ? Number(params.get('limit')) : null

  if (!/^[0-9a-f]{48}$/.test(token)) return reply(404, { error: 'not_found' })
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return reply(400, { error: 'dates_must_be_YYYY-MM-DD' })
  if (limit != null && (!Number.isInteger(limit) || limit < 1)) return reply(400, { error: 'limit_must_be_a_positive_integer' })

  try {
    const { data: link } = await db.from('share_links').select('user_id').eq('token', token).maybeSingle()
    if (!link) return reply(404, { error: 'not_found' })
    const userId = link.user_id as string

    const { data: allowed } = await db.from('api_access').select('user_id').eq('user_id', userId).maybeSingle()
    if (!allowed) return reply(404, { error: 'not_found' })

    const sessions = await all((a, b) => {
      let query = db.from('sessions').select('*').eq('user_id', userId).is('deleted_at', null)
      if (from) query = query.gte('date', from)
      if (to) query = query.lte('date', to)
      return query.order('date', { ascending: false }).order('id').range(a, b)
    })

    const sessionIds = new Set(sessions.map((session) => session.id))
    const sets = (await all((a, b) =>
      db.from('sets').select('*').eq('user_id', userId).is('deleted_at', null).order('id').range(a, b),
    )).filter((set) => sessionIds.has(set.session_id))

    const [{ data: profile }, routines, exercises, families] = await Promise.all([
      db.from('profiles').select('name, units, bodyweight_kg').eq('user_id', userId).maybeSingle(),
      all((a, b) => db.from('routines').select('id, name').eq('user_id', userId).range(a, b)),
      all((a, b) =>
        db.from('exercises').select('id, name, muscle_group, bodyweight, timed, family_id, variant')
          .or(`owner_id.is.null,owner_id.eq.${userId}`).range(a, b),
      ),
      all((a, b) => db.from('exercise_families').select('id, name').range(a, b)),
    ])

    const routineNames = new Map(routines.map((routine) => [routine.id, routine.name]))
    const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
    const familyNames = new Map(families.map((family) => [family.id, family.name]))

    const setsBySession = new Map<string, Row[]>()
    for (const set of sets) setsBySession.set(set.session_id, [...(setsBySession.get(set.session_id) ?? []), set])

    let workouts = sessions
      .filter((session) => (setsBySession.get(session.id) ?? []).some((set) => set.done))
      .map((session) => {
        const own = setsBySession.get(session.id)!
        own.sort((a, b) =>
          ((a.position ?? a.slot ?? 0) - (b.position ?? b.slot ?? 0)) || (a.set_index - b.set_index),
        )

        const groups = new Map<string, Row[]>()
        for (const set of own) {
          const key = `${set.position ?? set.slot ?? 0}|${set.exercise_id}`
          groups.set(key, [...(groups.get(key) ?? []), set])
        }

        const done = own.filter((set) => set.done)

        return {
          date: session.date,
          routine: workoutName(session, routineNames),
          note: session.note || null,
          deload: session.deload === true,
          done_sets: done.length,
          volume_kg: Math.round(done.reduce((total, set) =>
            set.weight == null || set.reps == null || exerciseById.get(set.exercise_id)?.timed
              ? total
              : total + Number(set.weight) * set.reps, 0)),
          exercises: [...groups.values()].map((group) => {
            const exercise = exerciseById.get(group[0].exercise_id)
            const bodyweightExercise = Boolean(exercise?.bodyweight)
            const timedExercise = Boolean(exercise?.timed)
            return {
              exercise: exercise?.name ?? 'Ejercicio borrado',
              exercise_id: group[0].exercise_id,
              family: exercise?.family_id ? familyNames.get(exercise.family_id) ?? null : null,
              variant: exercise?.variant ?? null,
              muscle_group: exercise?.muscle_group ?? null,
              bodyweight_exercise: bodyweightExercise,
              timed_exercise: timedExercise,
              sets: group.map((set) => setOf(set, bodyweightExercise, timedExercise)),
            }
          }),
        }
      })

    if (limit != null) workouts = workouts.slice(0, limit)

    return reply(200, {
      athlete: profile?.name || null,
      source: 'SetLift',
      generated: new Date().toISOString(),
      units: 'kg',
      bodyweight_kg: profile?.bodyweight_kg != null ? Number(profile.bodyweight_kg) : null,
      notes: [
        'workouts are newest first; only workouts with at least one done set are listed',
        'deload: true marks a deload workout; SetLift leaves it out of records, 1RM estimates and progression',
        'weight_kg on bodyweight exercises is the total moved; bodyweight_kg is the body share and added_load_kg the extra load (negative = assisted)',
        'timed_exercise: true (planks, holds) logs seconds instead of reps, and its target reps are seconds too; those sets do not count towards volume_kg',
        'target is what was planned for the set; effort (rir / rpe / failure) is a target, not logged',
        'gear values: chalk, belt, straps, wristWraps, kneeSleeves',
        'send the key as Authorization: Bearer <key>; query params: from=YYYY-MM-DD, to=YYYY-MM-DD, limit=N (latest N workouts)',
      ],
      workouts,
    })
  } catch (error) {
    console.error(error)
    return reply(500, { error: 'server_error' })
  }
})
