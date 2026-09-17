interface SettingRowProps {
  label: string
  description?: string
  stacked?: boolean
  children: React.ReactNode
}

export default function SettingRow({ label, description, children, stacked = false }: SettingRowProps): React.JSX.Element {
  return (
    <div className={`flex ${stacked ? 'flex-col items-stretch gap-3' : 'items-center justify-between'} rounded-lg bg-card border border-border px-4 py-3`}>
      <div className="space-y-0.5 mr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={stacked ? 'w-full min-w-0' : 'shrink-0'}>
        {children}
      </div>
    </div>
  )
}
