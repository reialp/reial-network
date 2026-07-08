import type { Stats, MonthlyReport, Content, CreatorStats } from '../types'

export function exportReport(
  stats: Stats,
  monthlyReport: MonthlyReport[],
  filteredContent: Content[],
  creatorStats: CreatorStats[],
  dateRange: { start: string; end: string },
) {
  try {
    const now = new Date()
    const reportDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const totalRevenue = Number(stats.totalRevenue) || 0
    const totalFees = Number(stats.totalPlatformFees) || 0
    const totalEarnings = Number(stats.totalPaidToCreators) || 0

    const report: string[] = []
    report.push('='.repeat(80))
    report.push('PLATFORM PERFORMANCE REPORT')
    report.push('='.repeat(80))
    report.push(`Report Generated: ${reportDate}`)
    report.push(`Report Period: ${dateRange.start || 'All Time'} to ${dateRange.end || 'Present'}`)
    report.push('='.repeat(80))
    report.push('')

    report.push('EXECUTIVE SUMMARY')
    report.push('-'.repeat(80))
    report.push(`Total Revenue:              KES ${totalRevenue.toFixed(2)}`)
    // UPDATED: Changed from 15% to 30%
    report.push(`Platform Fees (30%):        KES ${totalFees.toFixed(2)}`)
    // UPDATED: Changed from 85% to 70%
    report.push(`Creator Earnings (70%):     KES ${totalEarnings.toFixed(2)}`)
    report.push(`Total Sales:                ${stats.totalSales}`)
    report.push(`Total Films:                ${stats.totalFilms}`)
    report.push(`Total Creators:             ${stats.totalCreators}`)
    report.push(`Total Views:                ${stats.totalViews}`)
    report.push(`Pending Submissions:        ${stats.pendingSubmissions}`)
    report.push(`Pending Payouts:            KES ${Number(stats.pendingPayouts).toFixed(2)}`)
    report.push('')

    report.push('MONTHLY BREAKDOWN')
    report.push('-'.repeat(80))
    if (monthlyReport.length > 0) {
      report.push('Month'.padEnd(15) + 'Transactions'.padEnd(15) + 'Revenue (KES)'.padEnd(15) + 'Fees (KES)'.padEnd(15) + 'Earnings (KES)'.padEnd(15) + 'Unique Buyers'.padEnd(15) + 'Unique Films')
      report.push('-'.repeat(80))
      monthlyReport.forEach(m => {
        report.push(
          `${m.month} ${m.year}`.padEnd(15) +
          m.total_transactions.toString().padEnd(15) +
          m.total_revenue.toFixed(2).padEnd(15) +
          m.total_fees.toFixed(2).padEnd(15) +
          m.total_earnings.toFixed(2).padEnd(15) +
          m.unique_buyers.toString().padEnd(15) +
          m.unique_films.toString()
        )
      })
      report.push('')
      const avgRevenue = monthlyReport.reduce((s, m) => s + m.total_revenue, 0) / monthlyReport.length
      const avgFees = monthlyReport.reduce((s, m) => s + m.total_fees, 0) / monthlyReport.length
      const avgEarnings = monthlyReport.reduce((s, m) => s + m.total_earnings, 0) / monthlyReport.length
      report.push('Monthly Average:')
      report.push(`  Average Revenue:  KES ${avgRevenue.toFixed(2)}`)
      report.push(`  Average Fees:     KES ${avgFees.toFixed(2)}`)
      report.push(`  Average Earnings: KES ${avgEarnings.toFixed(2)}`)
      report.push('')
    } else {
      report.push('No monthly data available.')
      report.push('')
    }

    report.push('CONTENT DETAILS')
    report.push('-'.repeat(80))
    report.push('Title'.padEnd(35) + 'Creator'.padEnd(20) + 'Price'.padEnd(10) + 'Status'.padEnd(12) + 'Views'.padEnd(10) + 'Sales'.padEnd(10) + 'Revenue (KES)')
    report.push('-'.repeat(80))
    if (filteredContent.length > 0) {
      filteredContent.forEach(item => {
        const revenue = item.price * (item.purchase_count || 0)
        report.push(
          item.title.substring(0, 30).padEnd(35) +
          (item.creator_name || 'Unknown').substring(0, 18).padEnd(20) +
          item.price.toFixed(2).padEnd(10) +
          item.status.padEnd(12) +
          (item.views || 0).toString().padEnd(10) +
          (item.purchase_count || 0).toString().padEnd(10) +
          revenue.toFixed(2)
        )
      })
      report.push('')
    } else {
      report.push('No content available for the selected filters.')
      report.push('')
    }

    report.push('CREATOR SUMMARY')
    report.push('-'.repeat(80))
    report.push('Creator'.padEnd(25) + 'Films'.padEnd(10) + 'Revenue (KES)'.padEnd(15) + 'Earnings (KES)'.padEnd(15) + 'Views')
    report.push('-'.repeat(80))
    const activeCreators = creatorStats.filter(c => c.total_films > 0)
    if (activeCreators.length > 0) {
      activeCreators.forEach(creator => {
        // UPDATED: Changed from 0.85 to 0.70
        const earnings = Number(creator.total_revenue) * 0.70
        report.push(
          creator.creator_name.substring(0, 23).padEnd(25) +
          creator.total_films.toString().padEnd(10) +
          Number(creator.total_revenue).toFixed(2).padEnd(15) +
          earnings.toFixed(2).padEnd(15) +
          creator.total_views.toString()
        )
      })
      report.push('')
    } else {
      report.push('No active creators with films.')
      report.push('')
    }

    report.push('='.repeat(80))
    report.push('END OF REPORT')
    report.push('Generated by Admin Panel')
    report.push('='.repeat(80))

    const csvContent = report.join('\n')
    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `platform_report_${now.toISOString().split('T')[0]}.txt`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting report:', error)
    alert('Failed to export report')
  }
}
