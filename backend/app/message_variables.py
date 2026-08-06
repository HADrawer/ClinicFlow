import re

# The only variables a message template body may reference. Every key here
# is something the send-time renderer below can actually populate from real
# data — this list is the single source of truth for both backend validation
# (create/update template) and the frontend's variable-insertion menu.
MESSAGE_TEMPLATE_VARIABLES: dict[str, str] = {
    "patient_name": "Patient's full name",
    "doctor_name": "Treating doctor's name",
    "clinic_name": "Clinic name",
    "appointment_date": "Appointment date",
    "appointment_time": "Appointment time",
    "service_name": "Service name",
    "invoice_number": "Invoice number",
    "amount": "Amount due or paid",
}

_TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def unsupported_variables(body: str) -> set[str]:
    return {name for name in _TOKEN_RE.findall(body) if name not in MESSAGE_TEMPLATE_VARIABLES}


def render_template(body: str, values: dict[str, str]) -> str:
    """Plain text substitution only — never evaluates the body as code."""

    def replace(match: re.Match) -> str:
        return str(values.get(match.group(1), ""))

    return _TOKEN_RE.sub(replace, body)
