const { execFile } = require('child_process');
const path = require('path');

const intervalHours = Number(process.env.INGEST_INTERVAL_HOURS || 0);

if (!intervalHours) {
  console.log('Ingestion scheduler disabled. Set INGEST_INTERVAL_HOURS to enable.');
  return;
}

const scriptPath = path.join(__dirname, 'ingest-directory.js');

function runIngest() {
  execFile('node', [scriptPath], (err, stdout, stderr) => {
    if (err) {
      console.error('Scheduled ingest failed:', err.message);
      return;
    }
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
  });
}

console.log(`Ingestion scheduler enabled. Running every ${intervalHours} hours.`);
runIngest();
setInterval(runIngest, intervalHours * 60 * 60 * 1000);
