interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
}

const WORKOUTS_FUNCTION = 'https://odjvqrzpbksgyhskasda.supabase.co/functions/v1/workouts'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { headers: CORS })
    }

    if (url.pathname === '/api/v1/workouts' || url.pathname === '/api/v1/workouts/') {
      const target = new URL(WORKOUTS_FUNCTION)
      target.search = url.search
      const headers = new Headers()
      const key = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
      if (key) headers.set('x-api-key', key)
      return fetch(target, { method: request.method, headers })
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    return env.ASSETS.fetch(request)
  },
}
