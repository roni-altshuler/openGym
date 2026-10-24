import { env } from 'cloudflare:workers'
import { hostedApi } from '../../../lib/opengym-hosted.mjs'
export const dynamic = 'force-dynamic'
export const GET = (request: Request) => hostedApi(request, env)
export const POST = GET
export const PUT = GET
export const DELETE = GET
