# Run and deploy

## Local source preview

Requirements: Node.js 20 or newer. No npm dependencies or API keys.

```bash
npm run dev
```

Open `http://localhost:4173`. Stop with Ctrl+C.

Windows users may run `START-WINDOWS.cmd`. That launcher opens a separate server window and the browser.
The file does not install software or request administrator privileges.

## Production build

```bash
npm run check
npm test
npm run export
npm run build
npm start
```

Publish the contents of `dist/` to a static HTTPS origin. The standalone HTML contains the UI and original logo,
but embedded videos still require an internet connection and permission from their source.

## Vercel

Configuration reference: https://vercel.com/docs/project-configuration

The included `vercel.json` specifies:
- framework: Other / no framework preset;
- install command: `node --version` (there are no dependencies);
- build command: `npm run build`;
- output directory: `dist`.

Import this folder as a **new** Vercel project through your authorized account.
Do not overwrite an existing company website.
No environment secret is necessary for this open release. Confirm HTTPS, response headers,
and one actual video playback on desktop/mobile after deployment.

No public deployment was created in the build session.
The exposed deployment connector accepted no file payload in its declared schema but requested one at runtime.
That tool mismatch was not treated as a successful deployment.

## Other static hosting

Upload `dist/index.html`, `dist/robots.txt`, and `dist/_headers`.
`_headers` is a host-specific configuration convention, not a universal web-server instruction.
Copy the same security header intent to the chosen host when it does not support that file.
Hash routing means internal navigation does not require a catch-all server rewrite.

## Deployment checks

1. Root loads on HTTPS and has no JavaScript errors.
2. Arabic RTL and English LTR render at 390 px and desktop width.
3. Only Leadership is visible to learners.
4. No YouTube iframe exists before the user requests loading.
5. A real video plays on the actual corporate network.
6. Player errors show the external source link instead of a broken-only lesson.
7. Quiz score, reflection, and notes survive an actual browser reload.
8. Backup export, import, and reset work with explicit confirmation.
9. Browser password/autofill fields are not active account collection.
10. No employee database or verified-team metric is implied.

## Important operating notes

`robots.txt` and `noindex` are discovery hints, not privacy controls.
The admin preview is open by design and must not contain confidential staff information.
The current Content Security Policy permits inline script/style for the self-contained build.
A future authenticated product should use a production bundler, stricter CSP, server authorization,
and a security review. Do not market this open build as an authenticated LMS.

Keep the original exported local backup before moving domains or switching ports. Browser-origin storage
does not automatically migrate with your deployment.
