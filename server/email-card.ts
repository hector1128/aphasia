const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function emailCard({ title, text, action, note, unsubscribe }: {
  title: string; text: string; action?: { label: string; url: string }; note?: string; unsubscribe?: string;
}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#e9eee9;color:#243d38;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#e9eee9"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#fffefa;border:1px solid #dce4d9;border-radius:18px;">
<tr><td style="padding:20px 24px;background:#e6f0e4;border-radius:17px 17px 0 0;color:#356c48;font-size:22px;font-weight:bold;">My Day</td></tr>
<tr><td style="padding:26px 24px 24px;">
<h1 style="margin:0 0 14px;color:#243d38;font-size:26px;line-height:1.25;">${escape(title)}</h1>
<p style="margin:0;color:#243d38;font-size:18px;line-height:1.55;">${escape(text)}</p>
${action ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;"><tr><td bgcolor="#356c48" style="border-radius:12px;"><a href="${escape(action.url)}" style="display:inline-block;padding:14px 20px;color:#ffffff;font-weight:bold;font-size:17px;line-height:1.2;text-decoration:none;border-radius:12px;">${escape(action.label)}</a></td></tr></table>` : ""}
${note ? `<p style="margin:22px 0 0;padding:14px 16px;background:#e6f0e4;border-radius:10px;color:#243d38;font-size:15px;line-height:1.5;">${escape(note)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #dce4d9;color:#53665a;font-size:14px;line-height:1.5;">${unsubscribe ? `<a href="${escape(unsubscribe)}" style="color:#356c48;text-decoration:underline;">Turn off reminders</a>` : "My Day &middot; Activity log"}</td></tr>
</table></td></tr></table></body></html>`;
}
