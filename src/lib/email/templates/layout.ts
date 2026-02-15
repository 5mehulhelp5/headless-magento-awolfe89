export function wrapInLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Technimark</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#111827;padding:24px 32px;text-align:center;">
              <span style="font-size:22px;font-weight:bold;letter-spacing:3px;color:#ffffff;">TECHNIMARK-INC</span>
            </td>
          </tr>
          <!-- Red accent line -->
          <tr>
            <td style="background-color:#c8102e;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-align:center;">
                Technimark-Inc &middot; 720 Industrial Dr &middot; Cary, IL 60013
              </p>
              <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
                Phone: (847) 639-4700 &middot; Email: sales@technimark-inc.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
