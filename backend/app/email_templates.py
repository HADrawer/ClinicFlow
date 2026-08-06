from datetime import datetime


def staff_invitation_email(
    *,
    full_name: str,
    clinic_name: str,
    role: str,
    invitation_link: str,
    expires_at: datetime,
) -> tuple[str, str, str]:
    """Returns (subject, html_body, text_body) for a staff invitation email."""
    subject = f"You're invited to join {clinic_name} on ClinicFlow"
    expires_label = expires_at.strftime("%B %d, %Y at %H:%M UTC")

    html = f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f2f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #d6e1de;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#167d78;">
                  Staff invitation
                </p>
                <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.3;color:#10212b;">
                  Join {clinic_name} on ClinicFlow
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;font-size:14px;line-height:1.6;color:#3c4a4f;">
                <p style="margin:0 0 12px 0;">Hello {full_name},</p>
                <p style="margin:0 0 12px 0;">
                  You have been invited to join <strong>{clinic_name}</strong> as a
                  <strong>{role}</strong> on ClinicFlow. Use the button below to set your
                  password and activate your account.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;">
                <a href="{invitation_link}"
                   style="display:inline-block;background-color:#167d78;color:#ffffff;text-decoration:none;
                          font-size:14px;font-weight:600;padding:12px 24px;">
                  Activate your account
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px 32px;font-size:13px;line-height:1.6;color:#52656e;">
                <p style="margin:0 0 8px 0;">Or copy this link into your browser:</p>
                <p style="margin:0 0 12px 0;word-break:break-all;color:#0f625f;">{invitation_link}</p>
                <p style="margin:0;">This invitation expires on {expires_label} and can only be used once.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid #e3ebe9;font-size:12px;color:#8a9aa0;">
                If you were not expecting this invitation, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    text = f"""Join {clinic_name} on ClinicFlow

Hello {full_name},

You have been invited to join {clinic_name} as a {role} on ClinicFlow.

Activate your account using this link:
{invitation_link}

This invitation expires on {expires_label} and can only be used once.

If you were not expecting this invitation, you can safely ignore this email.
"""

    return subject, html, text
