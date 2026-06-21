import { useQuery } from '@tanstack/react-query'
import {
  Cpu, CheckCircle2, AlertTriangle,
  Database, Wifi, Mail, MessageSquare, RefreshCw,
} from 'lucide-react'
import { api } from '../../lib/api'

interface HealthStatus {
  status: string
}

const KNOWN_SERVICES = [
  { name: 'FastAPI (API)',         icon: Cpu,            desc: 'Primary REST API server' },
  { name: 'PostgreSQL',            icon: Database,        desc: 'Primary relational database' },
  { name: 'Redis (Pub/Sub)',        icon: Wifi,            desc: 'WebSocket pub/sub and caching' },
  { name: "Africa's Talking (SMS)", icon: MessageSquare,   desc: 'Patient SMS notifications' },
  { name: 'SendGrid (Email)',       icon: Mail,            desc: 'Transactional email delivery' },
]

export function AdminSystemPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<HealthStatus>({
    queryKey: ['health-check'],
    queryFn: () => api.get('/health', { baseURL: import.meta.env.VITE_API_URL ?? '' }).then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  const apiHealthy = !isError && data?.status === 'healthy'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
            System Health
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Infrastructure status and service health
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* API health banner */}
      <div
        className="card p-5 flex items-center gap-4"
        style={{ backgroundColor: isLoading ? 'var(--color-surface-2)' : apiHealthy ? 'var(--color-success-light)' : 'var(--color-danger-light)' }}
      >
        {isLoading ? (
          <div className="h-10 w-10 rounded-xl bg-gray-200 animate-pulse" />
        ) : apiHealthy ? (
          <CheckCircle2 className="h-8 w-8 shrink-0" style={{ color: 'var(--color-success)' }} />
        ) : (
          <AlertTriangle className="h-8 w-8 shrink-0" style={{ color: 'var(--color-danger)' }} />
        )}
        <div>
          <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {isLoading ? 'Checking API…' : apiHealthy ? 'API Operational' : 'API Unreachable'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {apiHealthy
              ? 'Backend health check passed — all core services reachable'
              : isError
                ? 'Could not reach the backend API. Check server logs.'
                : 'Checking…'}
          </p>
        </div>
      </div>

      {/* Known services */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Registered Services</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Connect a monitoring agent (e.g. Prometheus + Grafana) to see live latency, uptime, and error rates.
          </p>
        </div>
        {KNOWN_SERVICES.map((svc, i) => (
          <div
            key={svc.name}
            className="flex items-center gap-4 px-5 py-4"
            style={{ borderBottom: i < KNOWN_SERVICES.length - 1 ? '1px solid var(--color-border)' : 'none' }}
          >
            <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <svc.icon className="h-4.5 w-4.5" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{svc.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{svc.desc}</p>
            </div>
            <span
              className="text-[10px] font-bold rounded-full px-2.5 py-1"
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}
            >
              No metrics
            </span>
          </div>
        ))}
      </div>

      {/* Monitoring note */}
      <div className="card p-6 flex flex-col items-center justify-center py-12 text-center"
        style={{ border: '1px dashed var(--color-border)' }}>
        <Cpu className="h-10 w-10 mb-3" style={{ color: 'var(--color-border-strong)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Advanced Monitoring
        </p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Integrate Prometheus, Grafana, or a cloud APM (Datadog, Sentry) to see real-time latency, error rates, CPU and memory metrics.
        </p>
      </div>
    </div>
  )
}
