# Official Data Ingestion (Scaffold)

This project is wired to ingest CSV exports from official India trade data sources.
Due to access/licensing constraints, data must be downloaded from the official portals
and placed into `backend/data/incoming/` as CSV files with the following columns:

```
period,direction,hs_code,commodity,country,value_usd,quantity,unit,source
```

## Official Sources (Download Manually)

1. **APEDA Agri Exchange (Statistics & Analysis)**
   - Use the "Monthly Export Statement", "Exports from India", or "Three Years Export Statement" views.
   - Export/download the table (CSV/Excel) if available and save to `backend/data/incoming/`.

2. **Department of Commerce TradeStat / EIDB (DGCI&S)**
   - Use "Commodity-wise" import/export reports to download data by HS code and country.
   - Export/download the table (CSV/Excel) if available and save to `backend/data/incoming/`.

3. **DGCI&S Foreign Trade Data Dissemination Portal**
   - If you need detailed datasets beyond TradeStat, request/subscribe to official data.

## Ingest Workflow

1. Save CSV files to `backend/data/incoming/`.
2. Run `npm run ingest:dir` to ingest all CSVs in the folder.
3. Processed files are moved to `backend/data/processed/`.

## Scheduling

Set `INGEST_INTERVAL_HOURS=24` (or any number of hours) to auto-ingest the incoming
folder on a schedule when the server starts.

## Notes

- This scaffold does not scrape or bypass any official portals.
- Make sure you have the right permissions for the datasets you download.
