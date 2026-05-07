interface Step {
  done: boolean
  label: string
  detail: string
}

interface Props {
  hasHoldings: boolean
  hasFillTicker: boolean
  hasTrackedCreator: boolean
  hasStrategy: boolean
}

export function GettingStartedGuide({ hasHoldings, hasFillTicker, hasTrackedCreator, hasStrategy }: Props) {
  if (hasHoldings && hasFillTicker && hasTrackedCreator && hasStrategy) return null

  const steps: Step[] = [
    {
      done: hasHoldings,
      label: 'Add a holding',
      detail: 'Portfolio tab → "Add Holding". Enter your ticker, quantity, value, and category.',
    },
    {
      done: hasFillTicker,
      label: 'Star a buy target (★) per category',
      detail: 'In Portfolio, click ☆ next to a holding. The starred holding becomes the buy target for that category in your monthly plan. One star per category.',
    },
    {
      done: hasTrackedCreator,
      label: 'Track a creator',
      detail: 'Creators tab → click a creator card to follow their strategy. Their allocation will be blended with your trust weights.',
    },
    {
      done: hasStrategy,
      label: 'Refresh a creator\'s strategy',
      detail: 'Creators tab → click Refresh on a tracked creator. Pulse fetches their recent transcripts and uses AI to extract their asset allocation.',
    },
  ]

  const completedCount = steps.filter(s => s.done).length

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Getting Started</h2>
        <span className="text-xs text-zinc-500">{completedCount}/{steps.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-border rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? 'bg-accent text-white'
                  : 'border border-zinc-600 text-zinc-500'
              }`}
            >
              {step.done ? '✓' : i + 1}
            </span>
            <div>
              <p className={`text-sm font-medium ${step.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-white'}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{step.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
