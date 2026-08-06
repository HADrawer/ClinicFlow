# Every action Quick Create is allowed to offer. Each maps to a creation
# workflow that already exists elsewhere in ClinicFlow (Staff invitation is
# deliberately absent — it is only reachable through Staff management /
# clinic onboarding). `permissions` mirrors the same permission names the
# underlying endpoint already enforces, so a clinic can never expose an
# action a given staff member isn't authorized to use.
QUICK_CREATE_ACTIONS: dict[str, dict] = {
    "add_patient": {"label": "Add patient", "permissions": ["patients.create"]},
    "new_appointment": {
        "label": "New appointment",
        "permissions": ["appointments.manage_own", "appointments.manage_all"],
    },
    "new_invoice": {"label": "New invoice", "permissions": ["billing.create"]},
    "upload_document": {"label": "Upload document", "permissions": ["documents.manage"]},
    "record_incident": {"label": "Record incident", "permissions": ["quality.manage"]},
}

DEFAULT_QUICK_CREATE_ACTIONS: list[str] = [
    "add_patient",
    "new_appointment",
    "new_invoice",
    "upload_document",
    "record_incident",
]
