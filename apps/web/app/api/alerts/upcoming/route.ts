import { NextRequest, NextResponse } from 'next/server'
import { findUpcomingDueDates } from '@ContAI/validators'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const daysAheadParam = searchParams.get('daysAhead')
  const includePastDaysParam = searchParams.get('includePastDays')

  const monthsAhead = daysAheadParam
    ? Math.max(0, Math.min(3, Math.ceil(parseInt(daysAheadParam, 10) / 30)))
    : 1
  const includePastDays = includePastDaysParam ? parseInt(includePastDaysParam, 10) : 7

  const alerts = findUpcomingDueDates(new Date(), { monthsAhead, includePastDays })
  return NextResponse.json({ alerts })
}
