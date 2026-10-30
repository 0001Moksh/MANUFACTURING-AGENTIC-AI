# Memory monitoring

Memory Monitoring is a separate MAI plugin (`telegraf-memory-monitoring`) built on
the existing CPU plugin flow. It collects system RAM through Telegraf `inputs.mem`.

## Activate it

1. Open **Plugins → Add Plugin → Memory Monitoring**.
2. Choose the target OS and architecture and upload the same official Telegraf
   vendor package used for CPU. The existing `cpu-plugin.ipynb` prepares vendor
   packages and remains usable for both; a second download notebook is unnecessary.
3. Download the Memory bundle and run its installer on the target machine using
   the same PostgreSQL destination as CPU.
4. Confirm installation, then verify. Verification checks recent memory samples,
   independently of CPU samples. A successful CPU verification cannot verify Memory.
5. Open **Use-Case Library → Memory Utilization Monitoring**. Choose a host to view
   its chart, change the time range or refresh interval, or export CSV.

The existing setup wizard targets the machine running the MAI backend. It does
not provision remote machines. On macOS, start/restart Telegraf using the installed
configuration as described in the bundle. Linux archive installation requires an
existing working Telegraf service. Windows updates stop the existing service
before replacing its binary and restart it with the shared configuration.

## Reused implementation

- Registration, installer upload, download, preflight, confirmation, deletion,
  and plugin settings use the existing routes and UI. The registration request
  adds `plugin_id`, defaulting to CPU for older clients. Only the two supported
  IDs are accepted. Each has its own registration and bundle directory.
- `plugin_packager.py` accepts `--plugin cpu|memory`, defaulting to CPU. Both bundles
  collect CPU and memory in the legacy `mai-cpu.conf` file with one PostgreSQL
  output. This avoids competing services or duplicate outputs when adding memory.
- `public.telegraf_cpu` remains the CPU destination; `public.telegraf_mem` is the
  memory destination. Telegraf creates/extends the table using the existing output.
  No application database migration is required.
- Bundle revision 2 forces old cached bundles to regenerate on download.
- `useMonitoringData` is shared by CPU and Memory for refresh, cancellation, time
  ranges, loading and failure handling. Changing the range clears old data.
- `MonitoringControls` and `MetricTable` were extracted from the CPU dashboard;
  both dashboards use them. CPU-specific charts and per-core/process views remain.
- `host_telemetry.py` shares the bounded database read and plugin verification code.
  `memory_telemetry.py` normalizes platform-dependent fields.

Removing a registration removes its use-case card, as with CPU; it does not
uninstall Telegraf or delete collected data. Either new bundle collects both
metrics even if only one plugin is registered. An old CPU-only bundle can replace
the shared file; use a newly downloaded bundle after upgrading.

## Dashboard

The summary shows total, used and available RAM and capacity-weighted utilization
across selected hosts with a sample in the last two minutes. Bytes display as GiB.
Hosts older than two minutes are labeled stale and excluded from current totals.
The per-host table retains their last sample and timestamp for diagnosis.

The host chart shows `used_percent` over time. Missing values remain missing.
Free and cached RAM are optional; available RAM can include reclaimable cache,
so it is not treated as identical to free RAM. Telegraf-reported percentages are
preserved, with a byte-based fallback only when the percentage is absent.

Usage of at least 85% is a visual high-usage indicator. This release does not add
persistent threshold rules, sustained-duration alerting, email notifications,
process-level memory attribution, or AI memory analysis.

## API contract

`POST /api/admin/plugins` remains multipart. Add
`plugin_id=telegraf-memory-monitoring`; other upload fields remain unchanged.
Omitting the ID retains CPU behavior; unsupported IDs return 422.

`GET /api/plugins` now returns CPU and Memory records. Existing per-plugin setup
routes work with either ID. Verification of an unregistered plugin returns 409;
a missing table or no samples within ten minutes returns `success: false` and
sets the registration to `waiting_for_data`.

`GET /api/plugins/telegraf-memory-monitoring/memory-utilization?minutes=30&limit=1200`
returns:

- `plugin_id`, `window_minutes`, `sample_count`, `hosts`, `generated_at`.
- `samples` sorted oldest to newest, with `time`, `host`, `total`, `used`,
  `available`, `free`, `cached`, `buffered`, `used_percent`, `available_percent`.
- Byte values are numeric; percentages range from 0 to 100. Missing or invalid
  values are null, not zero. Timestamps are ISO strings.
- `minutes` is clamped to 1–1440; `limit` to 1–5000. These are the latest samples,
  not a guarantee of full coverage for a long time range or many hosts.
- A missing table returns an empty 200 payload while awaiting the first sample.
  Database failures/timeouts return 503; database reads have an eight-second bound.

CPU's existing endpoint and response fields are unchanged.

## Verification

Run focused tests without pytest:

```bash
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p test_host_monitoring.py -v
```

Tests cover missing platform fields, zero/invalid values, percentage fallbacks,
query limits/order, missing tables, separate plugin verification, error propagation,
and the content of both bundles for five package targets and both architectures.
Unix scripts are syntax checked; Windows payloads are inspected, not executed.

Local Telegraf 1.40.2 test-mode collection was checked with the shared configuration
and emitted both CPU and memory measurements. Test mode does not write PostgreSQL.
The frontend TypeScript check and production build were also checked. Live database
writes and installation on Windows/macOS still require validation in those environments.
