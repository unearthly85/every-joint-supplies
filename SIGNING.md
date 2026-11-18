# Windows code signing

Signing is **scaffolded and off**. This document is for whoever turns it on later. Do not buy or create a certificate as part of ordinary development. Unsigned CI installers are expected. Windows SmartScreen will warn on them until a certificate is in place. That warning is acceptable for a developer build and not acceptable for a church install (that is a later task).

The switch lives in `config/building/electron-builder.fork.cjs`. It runs for `npm run release`, `npm run release:local`, and the Windows installer workflow. A build **signs only when the secrets below are non-empty**. If they are missing, the script deletes the empty variables (GitHub Actions sets unused secrets to `""`, and electron-builder would otherwise treat that as a broken certificate path) and the NSIS installer is unsigned. `forceCodeSigning` stays `false`, so a missing certificate does not fail the build.

We never use FreeShow's certificate. `config/building/electron-builder.yaml` still names Live Church Solutions / Azure Trusted Signing profile `FreeShow`. Our config drops `azureSignOptions` from that file on every build. Do not point `AZURE_*` at their account.

## Turn on Authenticode (a .pfx we hold)

Create the certificate out of band. Store it as GitHub Actions secrets on this repository (Settings → Secrets and variables → Actions). Do not commit the file or put the password in the workflow YAML.

| Secret | Value |
|---|---|
| `WIN_CSC_LINK` | The `.pfx`, as a `file://` path on the runner or as a base64 string. electron-builder accepts either. |
| `WIN_CSC_KEY_PASSWORD` | The `.pfx` password. |

`CSC_LINK` and `CSC_KEY_PASSWORD` are the cross-platform names. If both styles are set, the fork treats that as "a certificate is present" and lets electron-builder sign. Prefer the `WIN_` names for this app so a future Mac certificate can use `CSC_LINK` without changing Windows.

The Windows workflow already passes these secrets through. Adding the secrets is enough. No workflow edit and no code edit. The log line `[every-joint] Windows signing: Authenticode certificate` confirms it. Without the secrets the line says `unsigned (no signing secrets)` and the job still uploads the installer.

Local equivalent, for a machine that already has the file:

```bash
export WIN_CSC_LINK="file:///absolute/path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="the-password"
npm run release:local -- --win nsis
```

## Turn on Azure Trusted Signing later (optional)

Only if we use a cloud signing account **we** own. All five of these must be set or signing stays off. An Authenticode `WIN_CSC_LINK` wins if both are present.

| Secret | Value |
|---|---|
| `AZURE_TENANT_ID` | Directory (tenant) id |
| `AZURE_CLIENT_ID` | App registration client id |
| `AZURE_CLIENT_SECRET` | Client secret |
| `AZURE_CODE_SIGNING_ACCOUNT` | Our Trusted Signing account name |
| `AZURE_CERTIFICATE_PROFILE` | Our certificate profile name |
| `AZURE_CODE_SIGNING_ENDPOINT` | Optional. Defaults to `https://eus.codesigning.azure.net/` |

`publisherName` sent to Azure is the product name from `src/extensions/church/product.json`.

## What not to do

- Do not set `azureSignOptions` back to `publisherName: Live Church Solutions` or `certificateProfileName: FreeShow`.
- Do not set `forceCodeSigning: true` until a church-bound release should fail closed when the certificate is missing.
- Do not commit a `.pfx`, a password, or a base64 certificate.
