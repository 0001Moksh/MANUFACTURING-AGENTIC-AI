# Telegraf connector bundles

MAI supports CPU, Memory, Disk, Network, MQTT Consumer, Modbus, and OPC UA as
independent plugin registrations. All use the same official Telegraf vendor
package for the selected operating system and architecture.

Each revision 3 bundle installs:

- `mai-host-base.conf` for CPU and memory baseline metrics.
- `mai-output.conf` for the single shared PostgreSQL destination.
- `mai-<connector>.conf` for the selected connector.

Installing a later connector leaves existing `mai-*.conf` connector files in
place. The installer removes the old combined `mai-cpu.conf` during migration to
avoid duplicate collectors and outputs.

## Connectors without source settings

Disk and Network need only `POSTGRES_DSN`. Disk collects filesystem capacity and
disk I/O into `public.telegraf_disk` and `public.telegraf_diskio`. Network writes
interface counters to `public.telegraf_net`.

## MQTT Consumer

Set these before running `install.sh`:

```bash
export POSTGRES_DSN='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable'
export MQTT_BROKER='tcp://broker.example:1883'
export MQTT_TOPIC='factory/#'
export MQTT_DATA_FORMAT='json'
export MQTT_USERNAME=''
export MQTT_PASSWORD=''
./install.sh
```

MQTT fields depend on the selected Telegraf parser. The current bundle supports
one broker URL and one topic filter and writes parsed fields to
`public.telegraf_mqtt`. Empty username and password select anonymous access.

## Modbus

The initial bundle polls one holding-register field. This is a safe starting
contract because register addresses and types must come from the equipment map.

```bash
export POSTGRES_DSN='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable'
export MODBUS_CONTROLLER='tcp://192.168.1.50:502'
export MODBUS_SLAVE_ID='1'
export MODBUS_DEVICE='energy-meter-1'
export MODBUS_FIELD='voltage'
export MODBUS_ADDRESS='0'
export MODBUS_BYTE_ORDER='AB'
export MODBUS_DATA_TYPE='UINT16'
export MODBUS_SCALE='0.1'
./install.sh
```

The measurement is `public.telegraf_modbus`. Add more register definitions to
the installed `mai-modbus.conf` only after checking the device register map.

## OPC UA

The initial bundle reads one node. Security and authentication must match the
server endpoint.

```bash
export POSTGRES_DSN='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable'
export OPCUA_ENDPOINT='opc.tcp://192.168.1.60:4840'
export OPCUA_NODE_NAME='server_state'
export OPCUA_NODE_ID='ns=0;i=2259'
export OPCUA_SECURITY_POLICY='None'
export OPCUA_SECURITY_MODE='None'
export OPCUA_AUTH_METHOD='Anonymous'
export OPCUA_USERNAME=''
export OPCUA_PASSWORD=''
./install.sh
```

For username authentication, set `OPCUA_AUTH_METHOD=UserName` and provide both
credential variables. The measurement is `public.telegraf_opcua`. Production
deployments should use the endpoint's required security policy, certificates,
and node IDs rather than the anonymous example.

## Verification and dashboards

Each plugin verifies only its own primary PostgreSQL table and requires a sample
from the last ten minutes. MQTT, Modbus, and OPC UA remain in `waiting_for_data`
until their upstream source produces a valid sample.

After verification, MAI adds a use-case card and a connector dashboard with host
and measurement filters, recent dynamic fields, time-range controls, refresh,
and CSV export. The API is:

```text
GET /api/plugins/{plugin_id}/telemetry?minutes=30&limit=1200
```

It returns samples in chronological order with `time`, `host`, `measurement`,
and a dynamic `fields` object. `minutes` is limited to 1–1440 and `limit` to
1–5000. Missing tables return an empty payload; database failures return 503.
