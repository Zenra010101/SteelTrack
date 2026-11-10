using SteelTrack.Application.DTOs.Reports;

namespace SteelTrack.Infrastructure.Services.Reports;

internal static class ReportFilterNormalizer
{
    public static (DateTime from, DateTime toExclusive, int page, int pageSize) Normalize(
        ReportQueryFilter filter)
    {
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 10, 500);

        DateTime fromDate;
        DateTime toExclusive;
        var todayLocal = SalesReportTimeZone.ToLocal(DateTime.UtcNow).Date;

        if (string.Equals(filter.Period, "yearly", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(filter.Period, "year", StringComparison.OrdinalIgnoreCase))
        {
            var anchor = filter.To?.Date ?? todayLocal;
            var fromLocal = filter.From?.Date ?? anchor.AddMonths(-12);
            fromDate = SalesReportTimeZone.LocalDateStartToUtc(fromLocal);
            toExclusive = SalesReportTimeZone.LocalDateStartToUtc(anchor.AddDays(1));
        }
        else if (string.Equals(filter.Period, "semester", StringComparison.OrdinalIgnoreCase))
        {
            var anchor = filter.To?.Date ?? todayLocal;
            var fromLocal = filter.From?.Date ?? anchor.AddMonths(-6);
            fromDate = SalesReportTimeZone.LocalDateStartToUtc(fromLocal);
            toExclusive = SalesReportTimeZone.LocalDateStartToUtc(anchor.AddDays(1));
        }
        else if (string.Equals(filter.Period, "trimester", StringComparison.OrdinalIgnoreCase))
        {
            var anchor = filter.To?.Date ?? todayLocal;
            var fromLocal = filter.From?.Date ?? anchor.AddMonths(-3);
            fromDate = SalesReportTimeZone.LocalDateStartToUtc(fromLocal);
            toExclusive = SalesReportTimeZone.LocalDateStartToUtc(anchor.AddDays(1));
        }
        else if (string.Equals(filter.Period, "monthly", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(filter.Period, "month", StringComparison.OrdinalIgnoreCase))
        {
            var anchor = filter.From?.Date ?? todayLocal;
            var fromLocal = new DateTime(anchor.Year, anchor.Month, 1);
            fromDate = SalesReportTimeZone.LocalDateStartToUtc(fromLocal);
            toExclusive = SalesReportTimeZone.LocalDateStartToUtc(fromLocal.AddMonths(1));
        }
        else if (string.Equals(filter.Period, "daily", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(filter.Period, "day", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(filter.Period, "today", StringComparison.OrdinalIgnoreCase))
        {
            var anchor = filter.From?.Date ?? todayLocal;
            fromDate = SalesReportTimeZone.LocalDateStartToUtc(anchor);
            toExclusive = SalesReportTimeZone.LocalDateStartToUtc(anchor.AddDays(1));
        }
        else
        {
            var fromLocal = filter.From?.Date ?? todayLocal.AddDays(-30);
            var toLocalInclusive = filter.To?.Date ?? todayLocal;
            fromDate = SalesReportTimeZone.LocalDateStartToUtc(fromLocal);
            toExclusive = SalesReportTimeZone.LocalDateStartToUtc(toLocalInclusive.AddDays(1));
            if (toExclusive <= fromDate)
                toExclusive = SalesReportTimeZone.LocalDateStartToUtc(fromLocal.AddDays(1));
        }

        return (fromDate, toExclusive, page, pageSize);
    }
}
