import { Card, CardContent } from '@renderer/components/ui/card'
import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  suffix?: string
}

export function StatCard({ icon: Icon, label, value, suffix }: StatCardProps): React.JSX.Element {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-semibold text-foreground leading-tight">
              {value}{suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
