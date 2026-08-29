# Private MAI License Server

This Flask project is a private internal service used only by MAI administrators to generate customer license files. It is not part of the customer runtime and must never be shipped with the MAI product.

## Development Setup

```bash
cd license-server
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local `.env` file (copy `.env.example`):

```bash
copy .env.example .env
```

Run the server:

```bash
python app.py
```

Open: http://localhost:5001/login

## Key Generation

The license server generates an Ed25519 keypair during first startup, storing the private key at `storage/private_key.pem` and the public key at `storage/public_key.pem`. The private key is never committed to Git and must be protected with normal internal secret management.

## Configuration

Set these variables in `.env`:

- `LICENSE_SERVER_SECRET_KEY`
- `LICENSE_SERVER_ADMIN_USERNAME`
- `LICENSE_SERVER_ADMIN_PASSWORD`
- `LICENSE_SERVER_PRIVATE_KEY_PATH`
- `LICENSE_SERVER_PUBLIC_KEY_PATH`
- `LICENSE_STORAGE_PATH`

## Admin Creation

The admin account is configured via environment variables. In production, use a strong unique password and restrict the license server to trusted internal networks.

## License Generation

Use the internal web UI to create a new license, including:

- Customer name
- Customer ID
- Product
- License type
- Start date
- Expiry date
- Installation binding
- Features
- Notes

The server generates five secure tokens, encrypts the payload, signs it with the Ed25519 private key, and downloads the resulting `.lic` file.

## License Renewal

Renewal is handled by the private license server with a new generated license file. The customer receives only the new `.lic` file and uploads it into MAI.

## License Revocation

The private server can revoke a license by updating the stored metadata. For offline deployments, revocation requires a future online validation policy; the current MAI runtime supports local validation only by default.

## License Storage

License metadata and generated records are stored under `license-server/storage/`.

## Security Requirements

- Strong admin authentication
- Password hashing (`werkzeug.security`)
- Session-based admin access
- CSRF protection for forms
- Rate limits
- Audit log in `storage/audit.log`
- No public anonymous generation endpoint
- No private key exposure through the UI

## Production Deployment

Run the private Flask app on a separate trusted internal host, behind VPN or private subnetwork access. Do not expose it to the public internet or customer networks.

## Backup / Recovery

Back up:

- `storage/private_key.pem`
- `storage/public_key.pem`
- `storage/licenses.json`
- `storage/audit.log`

If the private key is lost, new licenses cannot be issued without key rotation.

## Key Rotation

Rotate keys by generating a fresh private/public pair and updating the public key used by the customer-side validator. The old private key should be decommissioned once all older licenses are safely managed.

## Troubleshooting

- Missing PEM files: restart the server so they are generated.
- Invalid login: reset the strong password in `.env`.
- Generation errors: check that `storage/` is writable.
