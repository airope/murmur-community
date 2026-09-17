interface SettingSectionProps {
  title: string
  children: React.ReactNode
}

export default function SettingSection({ title, children }: SettingSectionProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h2>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}
